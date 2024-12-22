use anchor_lang::prelude::*;

declare_id!("AoRNpekD8CuunokmyWvqNyXqW8PProGtQK4WFPgq8DRh");

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

        // Ensure user is not in an active session
        require!(
            user_account.start_time == 0 || user_account.end_time != 0,
            ErrorCode::AlreadyInSession
        );

        user_account.start_time = timestamp;
        user_account.end_time = 0;
        Ok(())
    }

    pub fn end_session(ctx: Context<EndSession>, timestamp: i64) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;

        // Ensure user is in an active session
        require!(
            user_account.start_time != 0 && user_account.end_time == 0,
            ErrorCode::NotInSession
        );

        // Ensure end time is after start time
        require!(
            timestamp > user_account.start_time,
            ErrorCode::InvalidEndTime
        );

        user_account.end_time = timestamp;
        user_account.total_sessions = user_account.total_sessions.checked_add(1)
            .ok_or(ErrorCode::CalculationOverflow)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = user,
        space = UserAccount::LEN,
        seeds = [b"user", user.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DepositFunds<'info> {
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StartSession<'info> {
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct EndSession<'info> {
    #[account(
        mut,
        seeds = [b"user", user.key().as_ref()],
        bump,
        constraint = user_account.owner == user.key()
    )]
    pub user_account: Account<'info, UserAccount>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
pub struct UserAccount {
    pub owner: Pubkey,
    pub balance: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_sessions: u32,
}

impl UserAccount {
    pub const LEN: usize = 8 + // discriminator
        32 + // owner pubkey
        8 + // balance
        8 + // start_time
        8 + // end_time
        4; // total_sessions
}

#[error_code]
pub enum ErrorCode {
    #[msg("Calculation overflow")]
    CalculationOverflow,
    #[msg("User is already in an active session")]
    AlreadyInSession,
    #[msg("User is not in an active session")]
    NotInSession,
    #[msg("End time must be after start time")]
    InvalidEndTime,
}
