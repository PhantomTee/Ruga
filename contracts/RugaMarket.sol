// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract RugaMarket {
    struct Market {
        uint256 id;
        string tokenSymbol;
        string tokenName;
        string coingeckoId;
        uint256 createdAt;
        uint256 resolvesAt;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome;
        uint256 priceAtCreation;
        mapping(address => uint256) yesBets;
        mapping(address => uint256) noBets;
    }

    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => bool)) public claimed;
    uint256 public marketCount;
    address public immutable usdcToken;
    address public owner;
    uint256 public platformFeeBps = 200;
    uint256 public accruedPlatformFees;

    event MarketCreated(uint256 indexed id, string tokenSymbol, string coingeckoId, uint256 priceAtCreation, uint256 resolvesAt);
    event BetPlaced(uint256 indexed marketId, address indexed user, bool yes, uint256 amount);
    event MarketResolved(uint256 indexed marketId, bool rugged);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount, uint256 fee);
    event PlatformFeesWithdrawn(address indexed recipient, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed nextOwner);

    error NotOwner();
    error InvalidAmount();
    error InvalidMarket();
    error MarketClosed();
    error MarketNotResolved();
    error AlreadyClaimed();
    error NoWinnings();
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _usdcToken) {
        if (_usdcToken == address(0)) revert InvalidAmount();
        usdcToken = _usdcToken;
        owner = msg.sender;
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidAmount();
        emit OwnershipTransferred(owner, nextOwner);
        owner = nextOwner;
    }

    function createMarket(
        string calldata tokenSymbol,
        string calldata tokenName,
        string calldata coingeckoId,
        uint256 currentPrice
    ) external onlyOwner returns (uint256 marketId) {
        if (currentPrice == 0) revert InvalidAmount();
        marketId = ++marketCount;
        Market storage market = markets[marketId];
        market.id = marketId;
        market.tokenSymbol = tokenSymbol;
        market.tokenName = tokenName;
        market.coingeckoId = coingeckoId;
        market.createdAt = block.timestamp;
        market.resolvesAt = block.timestamp + 7 days;
        market.priceAtCreation = currentPrice;

        emit MarketCreated(marketId, tokenSymbol, coingeckoId, currentPrice, market.resolvesAt);
    }

    function betYes(uint256 marketId, uint256 amount) external {
        _bet(marketId, amount, true);
    }

    function betNo(uint256 marketId, uint256 amount) external {
        _bet(marketId, amount, false);
    }

    function resolveMarket(uint256 marketId, bool rugged) external onlyOwner {
        Market storage market = markets[marketId];
        if (market.id == 0) revert InvalidMarket();
        if (market.resolved) revert MarketClosed();
        market.resolved = true;
        market.outcome = rugged;
        emit MarketResolved(marketId, rugged);
    }

    function claimWinnings(uint256 marketId) external {
        Market storage market = markets[marketId];
        if (market.id == 0) revert InvalidMarket();
        if (!market.resolved) revert MarketNotResolved();
        if (claimed[marketId][msg.sender]) revert AlreadyClaimed();

        uint256 winnerStake = market.outcome ? market.yesBets[msg.sender] : market.noBets[msg.sender];
        if (winnerStake == 0) revert NoWinnings();

        uint256 winnerPool = market.outcome ? market.yesPool : market.noPool;
        uint256 loserPool = market.outcome ? market.noPool : market.yesPool;
        uint256 grossProfit = winnerPool == 0 ? 0 : (loserPool * winnerStake) / winnerPool;
        uint256 fee = (grossProfit * platformFeeBps) / 10_000;
        uint256 payout = winnerStake + grossProfit - fee;

        claimed[marketId][msg.sender] = true;
        accruedPlatformFees += fee;
        if (!IERC20(usdcToken).transfer(msg.sender, payout)) revert TransferFailed();
        emit WinningsClaimed(marketId, msg.sender, payout, fee);
    }

    function withdrawPlatformFees(address recipient, uint256 amount) external onlyOwner {
        if (recipient == address(0) || amount == 0) revert InvalidAmount();
        if (amount > accruedPlatformFees) revert InvalidAmount();
        accruedPlatformFees -= amount;
        if (!IERC20(usdcToken).transfer(recipient, amount)) revert TransferFailed();
        emit PlatformFeesWithdrawn(recipient, amount);
    }

    function getMarket(uint256 marketId)
        external
        view
        returns (
            uint256 id,
            string memory tokenSymbol,
            string memory tokenName,
            string memory coingeckoId,
            uint256 createdAt,
            uint256 resolvesAt,
            uint256 yesPool,
            uint256 noPool,
            bool resolved,
            bool outcome,
            uint256 priceAtCreation
        )
    {
        Market storage market = markets[marketId];
        return (
            market.id,
            market.tokenSymbol,
            market.tokenName,
            market.coingeckoId,
            market.createdAt,
            market.resolvesAt,
            market.yesPool,
            market.noPool,
            market.resolved,
            market.outcome,
            market.priceAtCreation
        );
    }

    function getUserBets(uint256 marketId, address user) external view returns (uint256 yes, uint256 no) {
        Market storage market = markets[marketId];
        return (market.yesBets[user], market.noBets[user]);
    }

    function _bet(uint256 marketId, uint256 amount, bool yes) private {
        if (amount == 0) revert InvalidAmount();
        Market storage market = markets[marketId];
        if (market.id == 0) revert InvalidMarket();
        if (market.resolved || block.timestamp >= market.resolvesAt) revert MarketClosed();
        if (!IERC20(usdcToken).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        if (yes) {
            market.yesPool += amount;
            market.yesBets[msg.sender] += amount;
        } else {
            market.noPool += amount;
            market.noBets[msg.sender] += amount;
        }

        emit BetPlaced(marketId, msg.sender, yes, amount);
    }
}
