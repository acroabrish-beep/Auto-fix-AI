import { useState, useEffect, useCallback } from 'react';
import { repairGuidesService } from '../services/database/repairGuides';
import { RepairGuide } from '../types';

export const useRepairGuides = (guideId?: string) => {
  const [guides, setGuides] = useState<RepairGuide[]>([]);
  const [currentGuide, setCurrentGuide] = useState<RepairGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuides = useCallback(async (category?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await repairGuidesService.listGuides(category);
      setGuides(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load repair guides');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGuideDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await repairGuidesService.getGuide(id);
      setCurrentGuide(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load guide details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (guideId) {
      fetchGuideDetail(guideId);
    } else {
      fetchGuides();
    }
  }, [guideId, fetchGuideDetail, fetchGuides]);

  return {
    guides,
    currentGuide,
    loading,
    error,
    fetchGuides,
    fetchGuideDetail
  };
};
