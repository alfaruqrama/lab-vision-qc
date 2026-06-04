import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import type { InstrumentType, ControlLevel } from '@/lib/types';
import { toast } from 'sonner';

import { InstrumentSelector } from '@/features/qc/components';
import { StepIndicator } from './StepIndicator';
import { StepLevel } from './StepLevel';
import { StepForm } from './StepForm';

/**
 * InputQC page — Multi-step wizard for entering daily QC data.
 * 
 * Step 1: Select instrument
 * Step 2: Select control level (skipped for CA660 & EASYLITE)
 * Step 3: Enter parameter values + optional AI photo extraction
 */
export default function InputQC() {
  const navigate = useNavigate();
  const { canAccess } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [instrument, setInstrument] = useState<InstrumentType | null>(null);
  const [level, setLevel] = useState<ControlLevel | null>(null);

  // Access control
  useEffect(() => {
    if (!canAccess('input-qc')) {
      toast.error('Akses ditolak', {
        description: 'Hanya admin dan petugas yang dapat mengakses halaman ini',
      });
      navigate('/qc');
    }
  }, [canAccess, navigate]);

  function handleInstrumentSelect(selected: InstrumentType) {
    setInstrument(selected);
    if (selected === 'CA660') {
      // CA660 only has 1 level, skip step 2
      setLevel('Kontrol');
      setStep(3);
    } else if (selected === 'EASYLITE') {
      // EasyLite: combined NORMAL + HIGH input, skip level select
      setLevel('NORMAL');
      setStep(3);
    } else {
      setLevel(null);
      setStep(2);
    }
  }

  function handleLevelSelect(selectedLevel: ControlLevel) {
    setLevel(selectedLevel);
    setStep(3);
  }

  function handleBackToInstrument() {
    setStep(1);
    setInstrument(null);
    setLevel(null);
  }

  function handleBackToLevel() {
    if (instrument === 'CA660' || instrument === 'EASYLITE') {
      handleBackToInstrument();
    } else {
      setStep(2);
      setLevel(null);
    }
  }

  // Determine total steps for indicator
  const totalSteps: 2 | 3 = (instrument === 'CA660' || instrument === 'EASYLITE') ? 2 : 3;

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      {step > 1 && (
        <StepIndicator currentStep={step} totalSteps={totalSteps} />
      )}

      {/* Step 1: Select instrument */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold">Input QC Harian</h1>
            <p className="text-sm text-muted-foreground">Pilih instrumen</p>
          </div>
          <InstrumentSelector onSelect={handleInstrumentSelect} />
        </div>
      )}

      {/* Step 2: Select level */}
      {step === 2 && instrument && (
        <StepLevel
          instrument={instrument}
          onSelect={handleLevelSelect}
          onBack={handleBackToInstrument}
        />
      )}

      {/* Step 3: Form entry */}
      {step === 3 && instrument && level && (
        <StepForm
          instrument={instrument}
          level={level}
          onBack={handleBackToLevel}
        />
      )}
    </div>
  );
}
