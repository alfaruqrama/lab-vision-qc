
-- Migration: Add excluded column to qc_records
-- Purpose: Allow markers for gross errors to be ignored in QC statistics

ALTER TABLE public.qc_records 
ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE;
