// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 whose full supply is minted to the launchpad.
/// The launchpad can move tokens out of a seller's balance during a sell,
/// so selling needs one transaction (no separate approve).
contract PumpToken {
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public immutable pump;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _supply) {
        name = _name;
        symbol = _symbol;
        pump = msg.sender;
        totalSupply = _supply;
        balanceOf[msg.sender] = _supply;
        emit Transfer(address(0), msg.sender, _supply);
    }

    function transfer(address to, uint256 v) external returns (bool) { _move(msg.sender, to, v); return true; }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        emit Approval(msg.sender, s, v);
        return true;
    }

    function transferFrom(address f, address t, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        if (a != type(uint256).max) { require(a >= v, "allowance"); allowance[f][msg.sender] = a - v; }
        _move(f, t, v);
        return true;
    }

    /// @dev Only the launchpad, only into the launchpad (used by sell).
    function pumpPull(address from, uint256 v) external {
        require(msg.sender == pump, "only pump");
        _move(from, pump, v);
    }

    function _move(address f, address t, uint256 v) internal {
        require(balanceOf[f] >= v, "balance");
        unchecked { balanceOf[f] -= v; }
        balanceOf[t] += v;
        emit Transfer(f, t, v);
    }
}

/// @title HederaPump bonding-curve launchpad
/// @notice HBAR amounts are in tinybars (Hedera EVM msg.value unit, 1 HBAR = 1e8).
contract HederaPump {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 public constant CURVE_SUPPLY = 800_000_000 ether; // sold on the curve
    uint256 public constant VIRTUAL_TOKENS = 1_073_000_000 ether;
    uint256 public constant FEE_BPS = 100;          // 1% per trade
    uint256 public constant CREATOR_SHARE_BPS = 3000; // 30% of the fee goes to the creator

    struct Curve {
        address creator;
        uint256 virtualHbar;   // tinybars
        uint256 virtualTokens;
        uint256 realHbar;      // tinybars held for this curve
        uint256 tokensSold;
        bool graduated;
        bool migrated;
    }

    address public owner;
    address public feeRecipient;
    uint256 public virtualHbarStart;  // tinybars
    uint256 public creationFee;       // tinybars
    bool public paused;
    uint256 public platformFees;      // tinybars claimable by feeRecipient
    mapping(address => uint256) public creatorFees;
    mapping(address => Curve) public curves;
    address[] public allTokens;
    uint256 private locked = 1;

    event TokenCreated(address indexed token, address indexed creator, string name, string symbol, string metadata);
    event Trade(address indexed token, address indexed trader, bool isBuy, uint256 hbarAmount, uint256 tokenAmount, uint256 fee, uint256 virtualHbar, uint256 virtualTokens);
    event Graduated(address indexed token, uint256 realHbar);
    event Migrated(address indexed token, address to, uint256 hbar, uint256 tokens);

    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier nonReentrant() { require(locked == 1, "reentrant"); locked = 2; _; locked = 1; }
    modifier live() { require(!paused, "paused"); _; }

    constructor(address _feeRecipient, uint256 _virtualHbarStart, uint256 _creationFee) {
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        virtualHbarStart = _virtualHbarStart;
        creationFee = _creationFee;
    }

    function tokenCount() external view returns (uint256) { return allTokens.length; }

    function createToken(string calldata name_, string calldata symbol_, string calldata metadata) external payable live nonReentrant returns (address token) {
        require(bytes(name_).length > 0 && bytes(name_).length <= 32, "name");
        require(bytes(symbol_).length > 0 && bytes(symbol_).length <= 10, "symbol");
        require(bytes(metadata).length <= 1024, "metadata");
        require(msg.value >= creationFee, "fee");
        token = address(new PumpToken(name_, symbol_, TOTAL_SUPPLY));
        curves[token] = Curve(msg.sender, virtualHbarStart, VIRTUAL_TOKENS, 0, 0, false, false);
        allTokens.push(token);
        platformFees += creationFee;
        emit TokenCreated(token, msg.sender, name_, symbol_, metadata);
        uint256 extra = msg.value - creationFee;
        if (extra > 0) _buy(token, msg.sender, extra, 0);
    }

    function buy(address token, uint256 minTokensOut) external payable live nonReentrant {
        _buy(token, msg.sender, msg.value, minTokensOut);
    }

    function _buy(address token, address trader, uint256 value, uint256 minOut) internal {
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
            // fill to the end of the curve and refund the rest
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
        _takeFee(c.creator, fee);
        PumpToken(token).transfer(trader, out);
        emit Trade(token, trader, true, inAmt, out, fee, c.virtualHbar, c.virtualTokens);
        if (c.tokensSold >= CURVE_SUPPLY) {
            c.graduated = true;
            emit Graduated(token, c.realHbar);
        }
        if (refund > 0) _send(trader, refund);
    }

    function sell(address token, uint256 tokenAmount, uint256 minHbarOut) external live nonReentrant {
        Curve storage c = curves[token];
        require(c.creator != address(0), "unknown");
        require(!c.graduated, "graduated");
        require(tokenAmount > 0, "zero");
        uint256 gross = (c.virtualHbar * tokenAmount) / (c.virtualTokens + tokenAmount);
        if (gross > c.realHbar) gross = c.realHbar;
        uint256 fee = (gross * FEE_BPS) / 10_000;
        uint256 net = gross - fee;
        require(net >= minHbarOut, "slippage");
        PumpToken(token).pumpPull(msg.sender, tokenAmount);
        c.virtualHbar -= gross;
        c.virtualTokens += tokenAmount;
        c.realHbar -= gross;
        c.tokensSold -= tokenAmount;
        _takeFee(c.creator, fee);
        emit Trade(token, msg.sender, false, gross, tokenAmount, fee, c.virtualHbar, c.virtualTokens);
        _send(msg.sender, net);
    }

    function _takeFee(address creator, uint256 fee) internal {
        uint256 cf = (fee * CREATOR_SHARE_BPS) / 10_000;
        creatorFees[creator] += cf;
        platformFees += fee - cf;
    }

    function claimCreatorFees() external nonReentrant {
        uint256 a = creatorFees[msg.sender];
        require(a > 0, "none");
        creatorFees[msg.sender] = 0;
        _send(msg.sender, a);
    }

    function claimPlatformFees() external nonReentrant {
        require(msg.sender == feeRecipient || msg.sender == owner, "auth");
        uint256 a = platformFees;
        platformFees = 0;
        _send(feeRecipient, a);
    }

    /// @notice After graduation, releases the raised HBAR and the 200M reserved tokens
    /// to the owner so a DEX pool can be created. Disclosed as an admin-assisted step.
    function migrate(address token, address to) external onlyOwner nonReentrant {
        Curve storage c = curves[token];
        require(c.graduated && !c.migrated, "state");
        c.migrated = true;
        uint256 hbar = c.realHbar;
        c.realHbar = 0;
        uint256 tokens = PumpToken(token).balanceOf(address(this));
        PumpToken(token).transfer(to, tokens);
        _send(to, hbar);
        emit Migrated(token, to, hbar, tokens);
    }

    function setPaused(bool p) external onlyOwner { paused = p; }
    function setCreationFee(uint256 f) external onlyOwner { creationFee = f; }
    function setFeeRecipient(address r) external onlyOwner { feeRecipient = r; }
    function transferOwnership(address o) external onlyOwner { owner = o; }

    function _send(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        require(ok, "send");
    }

    receive() external payable { revert("direct"); }
}
