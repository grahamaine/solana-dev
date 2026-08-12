use anchor_lang::prelude::*;

#[error_code]
pub enum VotingError {
    #[msg("Poll is not in draft status")]
    PollNotDraft,
    #[msg("Poll is not active")]
    PollNotActive,
    #[msg("Poll voting period has ended")]
    PollEnded,
    #[msg("Poll voting period has not ended yet")]
    PollNotEnded,
    #[msg("Only the poll creator may perform this action")]
    Unauthorized,
    #[msg("A poll needs at least two candidates before it can be activated")]
    NotEnoughCandidates,
    #[msg("Maximum number of candidates reached")]
    TooManyCandidates,
    #[msg("Provided string exceeds the maximum allowed length")]
    StringTooLong,
    #[msg("Candidate does not belong to this poll")]
    InvalidCandidate,
    #[msg("Poll duration must be positive")]
    InvalidDuration,
}
