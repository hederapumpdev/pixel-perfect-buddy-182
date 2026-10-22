// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// HederaPump Markets router: buy/sell any SaucerSwap V1 HBAR-pair token with a
// visible fee (max 1%) sent to feeRecipient. Holds no funds between calls.
// Deploy with unlimited automatic token associations so sells can receive tokens.

interface ISaucerSwapRouter {
    function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external payable returns (uint256[] memory amounts);
    function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline)
        external returns (uint256[] memory amounts);
}

interface IERC20Min {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract HederaPumpRouter {
    uint16 public constant MAX_FEE_BPS = 100; // 1% hard cap
    ISaucerSwapRouter public immutable router;
    address public immutable whbar;
    address public owner;
    address payable public feeRecipient;
    uint16 public feeBps = 100;
    bool private locked;

    event Bought(address indexed trader, address indexed token, uint256 hbarIn, uint256 fee, uint256 tokensOut);
    event Sold(address indexed trader, address indexed token, uint256 tokensIn, uint256 fee, uint256 hbarOut);
    event FeeChanged(uint16 bps, address recipient);

    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    modifier nonReentrant() { require(!locked, "reentrant"); locked = true; _; locked = false; }

    constructor(address router_, address whbar_, address payable feeRecipient_) {
        require(router_ != address(0) && whbar_ != address(0) && feeRecipient_ != address(0), "zero");
        router = ISaucerSwapRouter(router_);
        whbar = whbar_;
        feeRecipient = feeRecipient_;
        owner = msg.sender;
    }

    function quoteFee(uint256 amount) public view returns (uint256) { return amount * feeBps / 10_000; }

    function buy(address token, uint256 minTokensOut, uint256 deadline) external payable nonReentrant returns (uint256 out) {
        require(msg.value > 0, "amount");
        uint256 fee = quoteFee(msg.value);
        address[] memory path = new address[](2);
        path[0] = whbar;
        path[1] = token;
        uint256[] memory amounts = router.swapExactETHForTokens{value: msg.value - fee}(minTokensOut, path, msg.sender, deadline);
        out = amounts[amounts.length - 1];
        _send(feeRecipient, fee);
        emit Bought(msg.sender, token, msg.value, fee, out);
    }

    function sell(address token, uint256 amountIn, uint256 minHbarOut, uint256 deadline) external nonReentrant returns (uint256 net) {
        require(amountIn > 0, "amount");
        require(IERC20Min(token).transferFrom(msg.sender, address(this), amountIn), "transfer");
        require(IERC20Min(token).approve(address(router), amountIn), "approve");
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = whbar;
        uint256 before = address(this).balance;
        router.swapExactTokensForETH(amountIn, 0, path, address(this), deadline);
        uint256 got = address(this).balance - before;
        uint256 fee = quoteFee(got);
        net = got - fee;
        require(net >= minHbarOut, "slippage");
        _send(feeRecipient, fee);
        _send(payable(msg.sender), net);
        emit Sold(msg.sender, token, amountIn, fee, net);
    }

    function setFee(uint16 bps, address payable recipient) external onlyOwner {
        require(bps <= MAX_FEE_BPS, "cap");
        require(recipient != address(0), "zero");
        feeBps = bps;
        feeRecipient = recipient;
        emit FeeChanged(bps, recipient);
    }

    function transferOwnership(address next) external onlyOwner { require(next != address(0), "zero"); owner = next; }

    function _send(address payable to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "send");
    }

    receive() external payable {}
}
