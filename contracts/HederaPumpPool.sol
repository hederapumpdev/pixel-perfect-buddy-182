// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Hedera Token Service precompile (0x167) — only the calls this contract needs.
/// These are the exact signatures already proven on mainnet in HederaPumpV4.sol.
interface IHTS {
    function transferToken(address token, address sender, address recipient, int64 amount) external returns (int64);
    function transferFrom(address token, address from, address to, uint256 amount) external returns (int64);
}

/// @title HederaPump Pools — our own exchange for coins that finished their bonding curve.
/// @notice One contract holds a HBAR/coin pool for every graduated coin. Anyone can add or
/// remove liquidity and gets a non-transferable share balance for it. Every swap charges
/// `feeBps` on what the trader receives; `lpFeeBps` of that stays inside the pool for the
/// liquidity providers and the rest goes to `feeRecipient`.
/// @dev Safety properties this contract is built around:
/// - It has no receive(), so HBAR can only arrive through addLiquidity or a swap. Nothing can
///   end up inside the contract that the reserves do not account for.
/// - Only addLiquidity, removeLiquidity and the two swap functions move value out, and each of
///   them only ever moves what the caller is entitled to. Not even the owner can take someone
///   else's liquidity: the owner can change fees and pause, and nothing else.
/// - removeLiquidity deliberately ignores `paused`, so providers can always get their money out.
/// - Reserves are updated before value leaves, and everything is reentrancy-guarded because the
///   token transfers are external calls.
/// - A pool is created by its first deposit, so there is no empty-pool state to exploit and no
///   way to front-run a creation.
/// @dev Deploy with unlimited max auto-associations so the contract can receive HTS tokens.
/// HBAR is in tinybars and HTS coins have 8 decimals, like every other HederaPump contract.
contract HederaPumpPool {
    IHTS constant HTS = IHTS(address(0x167));
    int64 constant OK = 22;

    uint16 public constant MAX_FEE_BPS = 300; // 3% hard cap, so a fee change can never surprise
    uint16 public feeBps = 100;               // 1.00% of what a trader receives
    uint16 public lpFeeBps = 25;              // 0.25% of that stays with the liquidity providers
    uint256 public constant MIN_SHARES = 1000; // locked in this contract forever

    struct Pool {
        uint256 reserveHbar;
        uint256 reserveToken;
        uint256 totalShares;
        bool exists;
    }

    mapping(address => Pool) public pools;
    mapping(address => mapping(address => uint256)) public shares;

    address public owner;
    address payable public feeRecipient;
    bool public paused;
    bool private locked;

    event PoolAdded(address indexed token, address indexed provider, uint256 hbar, uint256 tokens, uint256 minted);
    event PoolRemoved(address indexed token, address indexed provider, uint256 burned, uint256 hbar, uint256 tokens);
    event Swapped(address indexed token, address indexed trader, bool isBuy, uint256 inAmount, uint256 outAmount, uint256 fee);
    event FeeChanged(uint16 feeBps, uint16 lpFeeBps, address recipient);
    event Paused(bool paused);

    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier nonReentrant() { require(!locked, "reentrant"); locked = true; _; locked = false; }
    modifier live() { require(!paused, "paused"); _; }

    constructor(address payable feeRecipient_) {
        require(feeRecipient_ != address(0), "zero");
        owner = msg.sender;
        feeRecipient = feeRecipient_;
    }

    // ---------------------------------------------------------------- liquidity

    /// @notice Add HBAR and coins to a coin's pool. The HBAR rides along as the call's value and
    /// the coins are pulled with an allowance the caller set beforehand. A first deposit also
    /// opens the pool and fixes its starting price. `minShares` is the slippage limit.
    function addLiquidity(address token, uint256 tokenAmount, uint256 minShares, uint256 deadline)
        external payable nonReentrant live returns (uint256 minted)
    {
        require(token != address(0) && token != address(this), "token");
        require(msg.value > 0 && tokenAmount > 0, "amount");
        require(block.timestamp <= deadline, "deadline");

        Pool storage p = pools[token];
        require(HTS.transferFrom(token, msg.sender, address(this), tokenAmount) == OK, "transfer (approve first)");
        uint256 hbar = msg.value;

        if (p.totalShares == 0) {
            // Opening deposit: any ratio is fair because the pool prices itself from it.
            minted = isqrt(hbar * tokenAmount) - MIN_SHARES;
            require(minted >= minShares, "slippage");
            shares[token][address(this)] = MIN_SHARES;
            p.totalShares = minted + MIN_SHARES;
            p.exists = true;
        } else {
            require(p.reserveHbar > 0 && p.reserveToken > 0, "reserves");
            uint256 byHbar = (hbar * p.totalShares) / p.reserveHbar;
            uint256 byToken = (tokenAmount * p.totalShares) / p.reserveToken;
            minted = byHbar < byToken ? byHbar : byToken;
            require(minted >= minShares, "slippage");
            p.totalShares += minted;
        }

        shares[token][msg.sender] += minted;
        p.reserveHbar += hbar;
        p.reserveToken += tokenAmount;
        emit PoolAdded(token, msg.sender, hbar, tokenAmount, minted);
    }

    /// @notice Burn shares and take the matching slice of both sides back out. Works while the
    /// contract is paused, so liquidity can never be held hostage.
    function removeLiquidity(address token, uint256 shareAmount, uint256 minHbar, uint256 minToken, uint256 deadline)
        external nonReentrant returns (uint256 hbarOut, uint256 tokenOut)
    {
        require(shareAmount > 0, "amount");
        require(block.timestamp <= deadline, "deadline");

        Pool storage p = pools[token];
        require(shares[token][msg.sender] >= shareAmount, "balance");
        shares[token][msg.sender] -= shareAmount; // burn first, so shares can never be spent twice

        hbarOut = (shareAmount * p.reserveHbar) / p.totalShares;
        tokenOut = (shareAmount * p.reserveToken) / p.totalShares;
        require(hbarOut >= minHbar && tokenOut >= minToken, "slippage");

        p.reserveHbar -= hbarOut;
        p.reserveToken -= tokenOut;
        require(HTS.transferToken(token, address(this), msg.sender, int64(int256(tokenOut))) == OK, "transfer");
        _send(payable(msg.sender), hbarOut);
        emit PoolRemoved(token, msg.sender, shareAmount, hbarOut, tokenOut);
    }

    // -------------------------------------------------------------------- swaps

    /// @notice Buy coins with HBAR. The price follows the pool's own reserves: the more HBAR
    /// pushed in, the more expensive the coins become.
    function swapExactHbarForTokens(address token, uint256 minOut, uint256 deadline)
        external payable nonReentrant live returns (uint256 out)
    {
        require(msg.value > 0, "amount");
        require(block.timestamp <= deadline, "deadline");

        Pool storage p = pools[token];
        require(p.exists && p.reserveHbar > 0 && p.reserveToken > 0, "pool");

        uint256 gross = (p.reserveToken * msg.value) / (p.reserveHbar + msg.value);
        (uint256 fee, uint256 protocol, uint256 lpFee) = splitFee(gross);
        out = gross - fee;
        require(out >= minOut, "slippage");

        // The trader's coins and our cut leave the reserve; the providers' cut stays inside it.
        p.reserveToken -= out + protocol;
        p.reserveHbar += msg.value;
        require(HTS.transferToken(token, address(this), msg.sender, int64(int256(out))) == OK, "transfer (associate token first)");
        _send(feeRecipient, protocol);
        emit Swapped(token, msg.sender, true, msg.value, out, fee);
    }

    /// @notice Sell coins for HBAR.
    function swapExactTokensForHbar(address token, uint256 tokenAmount, uint256 minOut, uint256 deadline)
        external nonReentrant live returns (uint256 out)
    {
        require(tokenAmount > 0, "amount");
        require(block.timestamp <= deadline, "deadline");

        Pool storage p = pools[token];
        require(p.exists && p.reserveHbar > 0 && p.reserveToken > 0, "pool");
        require(HTS.transferFrom(token, msg.sender, address(this), tokenAmount) == OK, "transfer (approve first)");

        uint256 gross = (p.reserveHbar * tokenAmount) / (p.reserveToken + tokenAmount);
        (uint256 fee, uint256 protocol, uint256 lpFee) = splitFee(gross);
        out = gross - fee;
        require(out >= minOut, "slippage");

        p.reserveHbar -= out + protocol;
        p.reserveToken += tokenAmount;
        _send(payable(msg.sender), out);
        _send(feeRecipient, protocol);
        emit Swapped(token, msg.sender, false, tokenAmount, out, fee);
    }

    // -------------------------------------------------------------------- views

    /// @notice What a trader would receive for `hbarIn`, and the fee inside it.
    function quoteBuy(address token, uint256 hbarIn) external view returns (uint256 out, uint256 fee) {
        Pool storage p = pools[token];
        if (!p.exists || p.reserveHbar == 0 || p.reserveToken == 0) return (0, 0);
        uint256 gross = (p.reserveToken * hbarIn) / (p.reserveHbar + hbarIn);
        (fee, , ) = splitFee(gross);
        return (gross - fee, fee);
    }

    /// @notice What a trader would receive for `tokenAmount`, and the fee inside it.
    function quoteSell(address token, uint256 tokenAmount) external view returns (uint256 out, uint256 fee) {
        Pool storage p = pools[token];
        if (!p.exists || p.reserveHbar == 0 || p.reserveToken == 0) return (0, 0);
        uint256 gross = (p.reserveHbar * tokenAmount) / (p.reserveToken + tokenAmount);
        (fee, , ) = splitFee(gross);
        return (gross - fee, fee);
    }

    /// @notice The pool's two sides and how many shares exist in total.
    function reserves(address token) external view returns (uint256 reserveHbar, uint256 reserveToken, uint256 totalShares) {
        Pool storage p = pools[token];
        return (p.reserveHbar, p.reserveToken, p.totalShares);
    }

    /// @notice What one share of a coin's pool is currently worth on both sides.
    function shareValue(address token, uint256 shareAmount) external view returns (uint256 hbar, uint256 tokens) {
        Pool storage p = pools[token];
        if (p.totalShares == 0) return (0, 0);
        return ((shareAmount * p.reserveHbar) / p.totalShares, (shareAmount * p.reserveToken) / p.totalShares);
    }

    // -------------------------------------------------------------------- owner

    /// @notice Only the fee level and the fee wallet can be changed, the fee stays under the cap
    /// and the providers' slice can never exceed the whole fee. Nothing else the owner can do
    /// touches anyone's money.
    function setFees(uint16 fee_, uint16 lp_, address payable recipient) external onlyOwner {
        require(fee_ <= MAX_FEE_BPS, "cap");
        require(lp_ <= fee_, "lp");
        require(recipient != address(0), "zero");
        feeBps = fee_;
        lpFeeBps = lp_;
        feeRecipient = recipient;
        emit FeeChanged(fee_, lp_, recipient);
    }

    /// @notice Stops new deposits and swaps. Removing liquidity keeps working.
    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit Paused(p);
    }

    function transferOwnership(address o) external onlyOwner {
        require(o != address(0), "zero");
        owner = o;
    }

    // ------------------------------------------------------------------ helpers

    function splitFee(uint256 gross) internal view returns (uint256 fee, uint256 protocol, uint256 lpFee) {
        fee = (gross * feeBps) / 10_000;
        lpFee = (gross * lpFeeBps) / 10_000;
        protocol = fee - lpFee;
    }

    /// @dev Integer square root (Babylonian); floor of the real root.
    function isqrt(uint256 x) internal pure returns (uint256 r) {
        if (x == 0) return 0;
        r = x;
        uint256 b = (x + 1) / 2;
        while (b < r) {
            r = b;
            b = (r + x / r) / 2;
        }
        return r;
    }

    function _send(address payable to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send");
    }
}
