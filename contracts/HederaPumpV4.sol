// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Hedera Token Service precompile (0x167) — only the parts we use.
interface IHTS {
    struct KeyValue { bool inheritAccountKey; address contractId; bytes ed25519; bytes ECDSA_secp256k1; address delegatableContractId; }
    struct TokenKey { uint256 keyType; KeyValue key; }
    struct Expiry { int64 second; address autoRenewAccount; int64 autoRenewPeriod; }
    struct HederaToken {
        string name; string symbol; address treasury; string memo;
        bool tokenSupplyType; int64 maxSupply; bool freezeDefault;
        TokenKey[] tokenKeys; Expiry expiry;
    }
    function createFungibleToken(HederaToken memory token, int64 initialTotalSupply, int32 decimals)
        external payable returns (int64 responseCode, address tokenAddress);
    function transferToken(address token, address sender, address recipient, int64 amount) external returns (int64);
    function transferFrom(address token, address from, address to, uint256 amount) external returns (int64);
    function approve(address token, address spender, uint256 amount) external returns (int64);
}

/// Exchange-rate precompile (0x168).
interface IExchangeRate {
    function tinycentsToTinybars(uint256 tinycents) external returns (uint256);
}

interface ISaucerFactory { function pairCreateFee() external view returns (uint256); }

interface ISaucerRouter {
    function addLiquidityETHNewPool(address token, uint256 amountTokenDesired, uint256 amountTokenMin,
        uint256 amountETHMin, address to, uint256 deadline)
        external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

/// @title HederaPump v4 bonding-curve launchpad: native HTS tokens with an information URL
/// in the token memo (not HIP-405 metadata), automatic SaucerSwap liquidity listing and
/// referral rewards. HBAR in tinybars (1e8). Tokens have 8 decimals. The contract is the token
/// treasury; tokens have no admin/supply/freeze keys, so supply is fixed forever.
/// Deploy with unlimited max auto-associations so the contract can receive the SaucerSwap LP token.
contract HederaPumpV4 {
    // Mainnet supports the legacy tuple at 0x167; HIP-1028 metadata creation is deferred.
    IHTS constant HTS = IHTS(address(0x167));
    IExchangeRate constant RATES = IExchangeRate(address(0x168));
    int64 constant OK = 22;

    uint256 public constant UNIT = 1e8;
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * UNIT;
    uint256 public constant CURVE_SUPPLY = 800_000_000 * UNIT;
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000 * UNIT;
    uint256 public constant FEE_BPS = 100;
    uint256 public constant CREATOR_SHARE_BPS = 3000;
    /// Share of the total fee reserved for the referrer (10% of the platform's 70% share).
    uint256 public constant REFERRER_SHARE_BPS = 700;

    struct Curve {
        address creator;
        uint256 virtualHbar;
        uint256 virtualTokens;
        uint256 realHbar;
        uint256 tokensSold;
        bool graduated;
        bool migrated;
    }

    address public owner;
    address public feeRecipient;
    address public immutable router;
    address public immutable factory;
    uint256 public virtualHbarStart;
    uint256 public creationFee;
    bool public paused;
    uint256 public platformFees;
    mapping(address => uint256) public creatorFees;
    // Shared referral pool: REFERRER_SHARE_BPS of every referred trade's fee goes into one
    // pool, split pro-rata by the trading volume each referrer's recruits generated. More
    // referrers = smaller slice each. Standard dividend accounting (scaled accumulator).
    uint256 public constant SCALE = 1e18;
    uint256 public accReferralPerVolume;
    uint256 public totalReferralVolume;
    mapping(address => uint256) public referralVolume;
    mapping(address => uint256) public referralRewardDebt;
    mapping(address => Curve) public curves;
    address[] public allTokens;
    uint256 private locked = 1;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, string metadata);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 hbarAmount, uint256 tokenAmount, uint256 fee, uint256 virtualHbar, uint256 virtualTokens);
    event ReferralFee(address indexed token, address indexed referrer, uint256 amount);
    event Graduated(address indexed token, uint256 realHbar);
    event Migrated(address indexed token, address to, uint256 hbar, uint256 tokens);

    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier nonReentrant() { require(locked == 1, "reentrant"); locked = 2; _; locked = 1; }
    modifier live() { require(!paused, "paused"); _; }

    constructor(address _feeRecipient, uint256 _virtualHbarStart, uint256 _creationFee, address _router, address _factory) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        virtualHbarStart = _virtualHbarStart;
        creationFee = _creationFee;
        router = _router;
        factory = _factory;
    }

    function tokenCount() external view returns (uint256) { return allTokens.length; }

    /// @param metadata off-chain coin metadata (description/links JSON), emitted for indexing.
    /// @param metadataUrl Information URL stored in the token memo (max 100 UTF-8 bytes).
    /// This is not HIP-405 metadata; automatic ingestion by SaucerSwap is unconfirmed.
    /// @param buyHbar part of msg.value used for the creator's first buy. The rest above
    /// creationFee pays Hedera's token-creation fee; anything not charged is refunded.
    function createToken(string calldata name_, string calldata symbol_, string calldata metadata, string calldata metadataUrl, uint256 buyHbar)
        external payable live nonReentrant returns (address token)
    {
        require(bytes(name_).length > 0 && bytes(name_).length <= 32, "name");
        require(bytes(symbol_).length > 0 && bytes(symbol_).length <= 10, "symbol");
        require(bytes(metadata).length <= 1024, "metadata");
        require(bytes(metadataUrl).length <= 100, "metadataUrl");
        require(msg.value > creationFee + buyHbar, "fee");
        uint256 htsBudget = msg.value - creationFee - buyHbar;

        IHTS.HederaToken memory t;
        t.name = name_;
        t.symbol = symbol_;
        t.treasury = address(this);
        t.memo = bytes(metadataUrl).length > 0 ? metadataUrl : "HederaPump";
        t.tokenSupplyType = true;
        t.maxSupply = int64(int256(TOTAL_SUPPLY));
        t.tokenKeys = new IHTS.TokenKey[](0);
        t.expiry = IHTS.Expiry(0, address(this), 7_776_000);

        uint256 b0 = address(this).balance;
        (int64 rc, address tok) = HTS.createFungibleToken{value: htsBudget}(t, int64(int256(TOTAL_SUPPLY)), 8);
        require(rc == OK, "hts create");
        uint256 unspent = htsBudget - (b0 - address(this).balance);
        token = tok;
        curves[token] = Curve(msg.sender, virtualHbarStart, VIRTUAL_TOKENS, 0, 0, false, false);
        allTokens.push(token);
        platformFees += creationFee;
        emit TokenCreated(token, msg.sender, name_, symbol_, metadata);

        if (buyHbar > 0) _buy(token, msg.sender, buyHbar, 0, address(0));
        if (unspent > 0) _send(msg.sender, unspent);
    }

    /// @param referrer wallet that brought the trader in; gets REFERRER_SHARE_BPS of the fee.
    /// Pass address(0) for no referrer. The trader can never be their own referrer.
    function buy(address token, uint256 minTokensOut, address referrer) external payable live nonReentrant {
        _buy(token, msg.sender, msg.value, minTokensOut, referrer);
    }

    function _buy(address token, address trader, uint256 value, uint256 minOut, address referrer) internal {
        Curve storage c = curves[token];
        require(c.creator != address(0), "unknown");
        require(!c.graduated, "graduated");
        require(value > 0, "zero");
        uint256 fee = (value * FEE_BPS) / 10_000;
        uint256 inAmt = value - fee;
        uint256 out = (c.virtualTokens * inAmt) / (c.virtualHbar + inAmt);
        uint256 remaining = CURVE_SUPPLY - c.tokensSold;
        uint256 refund;
        if (out >= remaining) {
            out = remaining;
            uint256 needed = (c.virtualHbar * out) / (c.virtualTokens - out) + 1;
            fee = (needed * FEE_BPS) / (10_000 - FEE_BPS);
            refund = value - needed - fee;
            inAmt = needed;
        }
        require(out >= minOut, "slippage");
        c.virtualHbar += inAmt;
        c.virtualTokens -= out;
        c.realHbar += inAmt;
        c.tokensSold += out;
        _takeFee(token, c.creator, fee, referrer == trader ? address(0) : referrer, inAmt);
        require(HTS.transferToken(token, address(this), trader, int64(int256(out))) == OK, "transfer (associate token first)");
        emit Trade(token, trader, true, inAmt, out, fee, c.virtualHbar, c.virtualTokens);
        if (c.tokensSold >= CURVE_SUPPLY) {
            c.graduated = true;
            emit Graduated(token, c.realHbar);
            // Automatic SaucerSwap listing in the same transaction. If it fails (e.g. too
            // little gas), the buy still succeeds and migrate() remains as a fallback.
            try this.autoMigrate(token) {} catch {}
        }
        if (refund > 0) _send(trader, refund);
    }

    /// @notice Seller must first approve this contract as spender of the token.
    function sell(address token, uint256 tokenAmount, uint256 minHbarOut, address referrer) external live nonReentrant {
        Curve storage c = curves[token];
        require(c.creator != address(0), "unknown");
        require(!c.graduated, "graduated");
        require(tokenAmount > 0, "zero");
        uint256 gross = (c.virtualHbar * tokenAmount) / (c.virtualTokens + tokenAmount);
        if (gross > c.realHbar) gross = c.realHbar;
        uint256 fee = (gross * FEE_BPS) / 10_000;
        uint256 net = gross - fee;
        require(net >= minHbarOut, "slippage");
        require(HTS.transferFrom(token, msg.sender, address(this), tokenAmount) == OK, "transfer (approve first)");
        c.virtualHbar -= gross;
        c.virtualTokens += tokenAmount;
        c.realHbar -= gross;
        c.tokensSold -= tokenAmount;
        _takeFee(token, c.creator, fee, referrer == msg.sender ? address(0) : referrer, gross);
        emit Trade(token, msg.sender, false, gross, tokenAmount, fee, c.virtualHbar, c.virtualTokens);
        _send(msg.sender, net);
    }

    /// @notice Anyone can list a graduated coin on SaucerSwap. All raised HBAR (minus the
    /// SaucerSwap pool fee) and the remaining 200M tokens go into the pool. The LP token stays
    /// in this contract, which has no way to move it — the liquidity is locked forever.
    function migrate(address token) external nonReentrant { _migrate(token); }

    /// @dev Only callable by this contract itself, from _buy at graduation.
    function autoMigrate(address token) external {
        require(msg.sender == address(this), "self");
        _migrate(token);
    }

    function _migrate(address token) internal {
        Curve storage c = curves[token];
        require(c.graduated && !c.migrated, "state");
        c.migrated = true;
        uint256 poolFee = RATES.tinycentsToTinybars(ISaucerFactory(factory).pairCreateFee());
        require(c.realHbar > poolFee, "pool fee");
        uint256 hbar = c.realHbar - poolFee;
        c.realHbar = 0;
        uint256 tokens = TOTAL_SUPPLY - CURVE_SUPPLY;
        require(HTS.approve(token, router, tokens) == OK, "approve");
        (uint256 usedTok, uint256 usedHbar, ) = ISaucerRouter(router).addLiquidityETHNewPool{value: hbar + poolFee}(
            token, tokens, (tokens * 99) / 100, (hbar * 99) / 100, address(this), block.timestamp + 600);
        // leftovers (rounding) go to platform fees
        if (usedHbar < hbar) platformFees += hbar - usedHbar;
        emit Migrated(token, router, usedHbar, usedTok);
    }

    /// Platform share goes straight to the fee wallet on every trade; if that payout fails it
    /// is kept for claimPlatformFees so the trade never breaks. The creator share is kept for
    /// claimCreatorFees. With a valid referrer, REFERRER_SHARE_BPS of the fee goes into the
    /// shared referral pool; without one the platform keeps it.
    function _takeFee(address token, address creator, uint256 fee, address referrer, uint256 volume) internal {
        uint256 cf = (fee * CREATOR_SHARE_BPS) / 10_000;
        creatorFees[creator] += cf;
        uint256 pf = fee - cf;
        if (referrer != address(0)) {
            uint256 rf = (fee * REFERRER_SHARE_BPS) / 10_000;
            // Credit the volume first so the pool top-up below divides over all volume
            // including this trade (and never by zero).
            referralVolume[referrer] += volume;
            totalReferralVolume += volume;
            accReferralPerVolume += (rf * SCALE) / totalReferralVolume;
            referralRewardDebt[referrer] = (referralVolume[referrer] * accReferralPerVolume) / SCALE;
            pf -= rf;
            emit ReferralFee(token, referrer, rf);
        }
        if (pf == 0) return;
        (bool ok, ) = payable(feeRecipient).call{value: pf, gas: 10_000}("");
        if (!ok) platformFees += pf;
    }

    /// Referral rewards claimable right now: share of the pool earned on attributed volume,
    /// minus what was already claimed.
    function pendingReferralFees(address referrer) public view returns (uint256) {
        uint256 earned = (referralVolume[referrer] * accReferralPerVolume) / SCALE;
        uint256 debt = referralRewardDebt[referrer];
        return earned > debt ? earned - debt : 0;
    }

    function claimCreatorFees() external nonReentrant {
        uint256 a = creatorFees[msg.sender];
        require(a > 0, "none");
        creatorFees[msg.sender] = 0;
        _send(msg.sender, a);
    }

    function claimReferralFees() external nonReentrant {
        uint256 a = pendingReferralFees(msg.sender);
        require(a > 0, "none");
        referralRewardDebt[msg.sender] += a;
        _send(msg.sender, a);
    }

    function claimPlatformFees() external nonReentrant {
        require(msg.sender == feeRecipient || msg.sender == owner, "auth");
        uint256 a = platformFees;
        platformFees = 0;
        _send(feeRecipient, a);
    }

    function setPaused(bool p) external onlyOwner { paused = p; }
    function setCreationFee(uint256 f) external onlyOwner { creationFee = f; }
    function setFeeRecipient(address r) external onlyOwner { feeRecipient = r; }
    function transferOwnership(address o) external onlyOwner { owner = o; }

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "send");
    }

    /// Accepts refunds from the token service / router only.
    receive() external payable { require(msg.sender == router || msg.sender == address(0x167), "direct"); }
}
