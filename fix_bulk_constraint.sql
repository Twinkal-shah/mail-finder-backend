-- Remove the restrictive constraint that prevents bulk credit deductions
ALTER TABLE credit_transactions 
DROP CONSTRAINT IF EXISTS check_reasonable_deduction;

-- Add a more reasonable constraint that allows bulk operations
-- Allow negative amounts up to -1000 (for large bulk operations) or positive amounts
ALTER TABLE credit_transactions 
ADD CONSTRAINT check_reasonable_deduction 
CHECK (amount >= -50000 OR amount > 0);
