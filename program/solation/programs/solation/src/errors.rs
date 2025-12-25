use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The protocol is currently paused")]
    ProtocolPaused,

    #[msg("This asset is not enabled for trading")]
    AssetNotEnabled,

    #[msg("Insufficient liquidity available in market maker vault")]
    InsufficientLiquidity,

    #[msg("Quote has expired")]
    QuoteExpired,

    #[msg("Quote is not active")]
    QuoteNotActive,

    #[msg("Strike price not found in quote")]
    StrikePriceNotFound,

    #[msg("Contract size below minimum")]
    ContractSizeTooSmall,

    #[msg("Contract size above maximum")]
    ContractSizeTooLarge,

    #[msg("Position has not expired yet")]
    PositionNotExpired,

    #[msg("Position is not active")]
    PositionNotActive,

    #[msg("Position has already been settled")]
    PositionAlreadySettled,

    #[msg("Pyth price is too stale")]
    PriceTooStale,

    #[msg("Pyth feed ID mismatch")]
    PythFeedIdMismatch,

    #[msg("Invalid strike price range")]
    InvalidStrikeRange,

    #[msg("Invalid expiry range")]
    InvalidExpiryRange,

    #[msg("Math overflow")]
    MathOverflow,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Market maker is not active")]
    MarketMakerNotActive,

    #[msg("Too many strikes in quote")]
    TooManyStrikes,

    #[msg("Invalid quote parameters")]
    InvalidQuoteParameters,

    #[msg("Position request has expired")]
    RequestExpired,

    #[msg("Position request is not in pending status")]
    RequestNotPending,

    #[msg("Position request has not expired yet")]
    RequestNotExpired,

    #[msg("Only the market maker can confirm this request")]
    UnauthorizedConfirmation,
}
