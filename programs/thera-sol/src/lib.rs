use anchor_lang::prelude::*;

declare_id!("AoRNpekD8CuunokmyWvqNyXqW8PProGtQK4WFPgq8DRh");

#[program]
pub mod thera_sol {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
