import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import type { InstrumentType, ParamName, ParamConfig } from '@/lib/types';
import { getParamsForInstrument } from '@/lib/types';
import * as api from '@/lib/api';
import { toast } from 'sonner';

interface AIExtractionState {
  /** Preview URL of captured photo */
  photoPreview: string | null;
  /** Whether AI is currently processing */
  isLoading: boolean;
  /** Extracted result from AI */
  result: api.ReadStrukResult | null;
  /** Confidence percentage (0-100) */
  confidence: number | null;
  /** Full Easylite data (both levels) for level switching */
  easyliteData: api.ReadStrukResult | null;
}

interface UseAIExtractionOptions {
  instrument: InstrumentType | null;
  /** Function to get param config for accuracy calculation */
  getParamConfig?: (param: ParamName) => ParamConfig | null;
  /** Callback when values are extracted */
  onExtracted?: (values: Partial<Record<ParamName, string>>, meta?: { lot?: string; tanggal?: string }) => void;
}

/**
 * Custom hook encapsulating all AI OCR extraction logic.
 * Handles photo capture, API call, demo simulation, and result parsing.
 */
export function useAIExtraction({ instrument, getParamConfig, onExtracted }: UseAIExtractionOptions) {
  const [state, setState] = useState<AIExtractionState>({
    photoPreview: null,
    isLoading: false,
    result: null,
    confidence: null,
    easyliteData: null,
  });

  const connected = api.isConnected();

  // Mutation for AI extraction API call
  const extractMutation = useMutation({
    mutationFn: async ({ base64Data, mediaType }: { base64Data: string; mediaType: string }) => {
      if (!instrument) throw new Error('No instrument selected');
      return api.readStruk(base64Data, mediaType, instrument);
    },
  });

  /** Process photo and send to AI */
  const processPhoto = useCallback(
    async (dataUrl: string) => {
      if (!instrument) return;

      setState((prev) => ({ ...prev, photoPreview: dataUrl, isLoading: true, confidence: null, result: null }));

      try {
        const [meta, base64Data] = dataUrl.split(',');
        const mediaType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';

        if (!connected) {
          // Demo mode: simulate extraction
          simulateExtraction(instrument, getParamConfig);
          return;
        }

        const response = await extractMutation.mutateAsync({ base64Data, mediaType });

        if (response.status === 'ok' && response.data && !response.data.parseError) {
          applyResult(response.data);
        } else {
          toast.error('AI gagal baca otomatis, isi manual ya');
          setState((prev) => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        console.error('AI extraction error:', err);
        toast.error('Koneksi ke Apps Script gagal');
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    },
    [instrument, connected, getParamConfig],
  );

  /** Apply AI result to form */
  const applyResult = useCallback(
    (data: api.ReadStrukResult) => {
      if (!instrument) return;

      const params = getParamsForInstrument(instrument);
      let valuesToSet = data;

      // For Easylite: AI returns both NORMAL and HIGH in one response
      let easyliteData: api.ReadStrukResult | null = null;
      if (instrument === 'EASYLITE' && data.NORMAL && data.HIGH) {
        easyliteData = data;
        // Default to NORMAL level data
        const levelData = data.NORMAL;
        if (levelData) {
          valuesToSet = { ...data, ...levelData };
        }
      }

      // Calculate accuracy
      const filled = params.filter((p) => {
        const val = (valuesToSet as Record<string, unknown>)[p];
        return val !== null && val !== undefined;
      }).length;
      const acc = Math.round((filled / params.length) * 100);

      // Build values map
      const newValues: Partial<Record<ParamName, string>> = {};
      params.forEach((p) => {
        const val = (valuesToSet as Record<string, unknown>)[p];
        if (val !== null && val !== undefined) {
          newValues[p] = String(val);
        }
      });

      setState((prev) => ({
        ...prev,
        result: data,
        confidence: acc,
        isLoading: false,
        easyliteData,
      }));

      // Notify parent with extracted values
      onExtracted?.(newValues, { lot: data.lot, tanggal: data.tanggal });

      if (easyliteData) {
        toast.success('AI baca kedua level sekaligus! Switch Normal/High untuk isi level lainnya.');
      } else {
        toast.success('AI berhasil baca struk! Periksa sebelum simpan.');
      }
    },
    [instrument, onExtracted],
  );

  /** Simulate AI extraction in demo mode */
  const simulateExtraction = useCallback(
    (alat: InstrumentType, getConfig?: (param: ParamName) => ParamConfig | null) => {
      const params = getParamsForInstrument(alat);
      setTimeout(() => {
        const extracted: Partial<Record<ParamName, string>> = {};
        params.forEach((p) => {
          const cfg = getConfig?.(p);
          if (cfg) {
            const val = cfg.mean + (Math.random() - 0.5) * cfg.sd * 2;
            extracted[p] = val.toFixed(p === 'INR' ? 2 : 1);
          }
        });

        const acc = Math.round(85 + Math.random() * 12);
        setState((prev) => ({ ...prev, confidence: acc, isLoading: false }));
        onExtracted?.(extracted);
        toast.success('Nilai berhasil diekstrak dari foto (demo)');
      }, 2000);
    },
    [onExtracted],
  );

  /** Get values for a specific Easylite level from cached AI data */
  const getEasyliteLevelValues = useCallback(
    (level: 'NORMAL' | 'HIGH'): Partial<Record<ParamName, string>> | null => {
      if (!state.easyliteData) return null;
      const levelData = state.easyliteData[level];
      if (!levelData) return null;

      const newValues: Partial<Record<ParamName, string>> = {};
      (['Na', 'K', 'Cl'] as ParamName[]).forEach((p) => {
        const val = (levelData as Record<string, unknown>)[p];
        if (val !== null && val !== undefined) {
          newValues[p] = String(val);
        }
      });
      return newValues;
    },
    [state.easyliteData],
  );

  /** Reset all AI state (e.g. when retaking photo or changing instrument) */
  const reset = useCallback(() => {
    setState({
      photoPreview: null,
      isLoading: false,
      result: null,
      confidence: null,
      easyliteData: null,
    });
  }, []);

  return {
    ...state,
    processPhoto,
    getEasyliteLevelValues,
    reset,
  };
}
