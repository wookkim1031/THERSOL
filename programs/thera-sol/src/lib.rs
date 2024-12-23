use anchor_lang::prelude::*;

declare_id!("9TvEeaFS2aJLMaheLvwvZyhfksFN4khTaxeEctzZhqnW");

// Constants
pub const RATE_PER_MINUTE: u64 = 100_000; // 0.0001 SOL per minute
pub const MIN_SESSION_BALANCE: u64 = RATE_PER_MINUTE * 10; // 10 minutes worth of balance
pub const MAX_SESSIONS: usize = 10; // Maximum number of sessions to store

#[program]
pub mod thera_sol {
    use super::*;

    pub fn initialize_user(ctx: Context<InitializeUser>) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.owner = ctx.accounts.user.key();
        user_account.balance = 0;
        user_account.start_time = 0;
        user_account.end_time = 0;
        user_account.total_sessions = 0;
        user_account.session_history = Vec::new();
        Ok(())
    }

    pub fn deposit_funds(ctx: Context<DepositFunds>, amount: u64) -> Result<()> {
        // Transfer SOL from user to the PDA
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.user_account.to_account_info(),
            },
        );

        anchor_lang::system_program::transfer(cpi_context, amount)?;

        // Update user balance
        let user_account = &mut ctx.accounts.user_account;
        user_account.balance = user_account.balance.checked_add(amount)
            .ok_or(ErrorCode::CalculationOverflow)?;

        Ok(())
    }

    pub fn start_session(ctx: Context<StartSession>, timestamp: i64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;

        // Check if user is already in a session
        require!(user_account.start_time == 0, ErrorCode::AlreadyInSession);

        // Calculate free balance
        let free_balance = calculate_free_balance(user_account)?;

        // Check if user has enough free balance for minimum session duration
        require!(free_balance >= MIN_SESSION_BALANCE, ErrorCode::InsufficientBalance);

        user_account.start_time = timestamp;
        Ok(())
    }

    pub fn end_session(ctx: Context<EndSession>, timestamp: i64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;

        // Verify user is in a session
        require!(user_account.start_time > 0, ErrorCode::NotInSession);

        // Verify timestamp is valid (after start time)
        require!(timestamp > user_account.start_time, ErrorCode::InvalidEndTime);

        // Calculate session cost
        let session_duration_minutes = ((timestamp - user_account.start_time) / 60) as u64;
        let session_cost = session_duration_minutes.checked_mul(RATE_PER_MINUTE)
            .ok_or(ErrorCode::CalculationOverflow)?;

        // Verify user has enough balance
        require!(user_account.balance >= session_cost, ErrorCode::InsufficientBalance);

        // Create new session record
        let session = SessionRecord {
            start_time: user_account.start_time,
            end_time: timestamp,
            cost: session_cost,
        };

        // Add to session history
        if user_account.session_history.len() >= MAX_SESSIONS {
            user_account.session_history.remove(0); // Remove oldest session if at capacity
            // TODO: ensure that after removing the oldest, the total cost is still calculated correctly
        }
        user_account.session_history.push(session);

        // Update account state
        user_account.balance = user_account.balance.checked_sub(session_cost)
            .ok_or(ErrorCode::CalculationOverflow)?;
        user_account.end_time = timestamp;
        user_account.total_sessions += 1;
        user_account.start_time = 0; // Reset start time to indicate session is over

        Ok(())
    }

    pub fn reclaim_funds(ctx: Context<ReclaimFunds>, amount: u64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;

        // Verify user is not in an active session
        require!(user_account.start_time == 0, ErrorCode::ActiveSession);

        // Calculate free balance and verify amount
        let free_balance = calculate_free_balance(user_account)?;
        if amount > free_balance {
            return Err(ErrorCode::InsufficientBalance.into());
        }

        // Update balance
        user_account.balance = user_account.balance.checked_sub(amount)
            .ok_or(ErrorCode::CalculationOverflow)?;

        // Transfer SOL from PDA to user
        **ctx.accounts.user_account.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;

        Ok(())
    }

    pub fn check_free_balance(ctx: Context<CheckBalance>) -> Result<()> {
        let user_account = &ctx.accounts.user_account;
        let free_balance = calculate_free_balance(user_account)?;
        emit!(FreeBalanceEvent {
            user: user_account.owner,
            free_balance,
        });
        Ok(())
    }
}

#[event]
pub struct FreeBalanceEvent {
    pub user: Pubkey,
    pub free_balance: u64,
}

// Helper function to calculate free balance
fn calculate_free_balance(user_account: &UserAccount) -> Result<u64> {
    // Temporarily return just the balance without calculating history
    Ok(user_account.balance)
    
    /* Commented out history calculation for now
    let mut total_cost = 0u64;

    for session in &user_account.session_history {
        total_cost = total_cost.checked_add(session.cost)
            .ok_or(ErrorCode::CalculationOverflow)?;
    }

    // If in active session, estimate current session cost
    if user_account.start_time > 0 {
        let current_time = Clock::get()?.unix_timestamp;
        let session_duration_minutes = ((current_time - user_account.start_time) / 60) as u64;
        let current_session_cost = session_duration_minutes.checked_mul(RATE_PER_MINUTE)
            .ok_or(ErrorCode::CalculationOverflow)?;
        total_cost = total_cost.checked_add(current_session_cost)
            .ok_or(ErrorCode::CalculationOverflow)?;
    }

    Ok(user_account.balance.checked_sub(total_cost)
        .unwrap_or(0))
    */
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        init,
        payer = user,
        space = UserAccount::LEN,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartSession<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[derive(Accounts)]
pub struct EndSession<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[derive(Accounts)]
pub struct ReclaimFunds<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[derive(Accounts)]
pub struct CheckBalance<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,
}

#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_sessions: u32,
    pub session_history: Vec<SessionRecord>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SessionRecord {
    pub start_time: i64,
    pub end_time: i64,
    pub cost: u64,
}

impl UserAccount {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner pubkey
        8 + // balance
        8 + // start_time
        8 + // end_time
        4 + // total_sessions
        4 + // Vec length
        (MAX_SESSIONS * (8 + 8 + 8)) + // session_history (start_time + end_time + cost) * MAX_SESSIONS
        512; // extra space for future upgrades
}

#[error_code]
pub enum ErrorCode {
    #[msg("Calculation overflow")]
    CalculationOverflow,
    #[msg("User is already in an active session")]
    AlreadyInSession,
    #[msg("User is not in a session")]
    NotInSession,
    #[msg("End time must be after start time")]
    InvalidEndTime,
    #[msg("User is currently in a session")]
    ActiveSession,
    #[msg("Insufficient balance")]
    InsufficientBalance,
}
