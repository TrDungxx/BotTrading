import { useState, useCallback, useRef } from 'react';
import { MouseEventParams } from 'lightweight-charts';
import { InteractionMode, ContextMenuPosition } from '../types';

interface UseChartInteractionsReturn {
  // Hover state
  hoverPrice: number | null;
  setHoverPrice: (price: number | null) => void;
  
  // Context menu
  ctxOpen: boolean;
  ctxPosition: ContextMenuPosition | null;
  openCtxMenu: (e: React.MouseEvent) => void;
  closeCtxMenu: () => void;
  
  // Modals
  orderOpen: boolean;
  alertOpen: boolean;
  orderSeedPrice: number | null;
  orderPresetType: 'LIMIT' | 'STOP_MARKET';
  
  openOrderModal: (price: number, type: 'LIMIT' | 'STOP_MARKET') => void;
  closeOrderModal: () => void;
  openAlertModal: () => void;
  closeAlertModal: () => void;
  
  // Interaction mode
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  
  // Mouse event handlers
  handleChartClick: (param: MouseEventParams) => void;
  handleChartCrosshairMove: (param: MouseEventParams) => void;
}

/**
 * Custom hook to manage chart interactions
 */
export function useChartInteractions(): UseChartInteractionsReturn {
  // Hover state
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  
  // Context menu
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPosition, setCtxPosition] = useState<ContextMenuPosition | null>(null);
  
  // Modals
  const [orderOpen, setOrderOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [orderSeedPrice, setOrderSeedPrice] = useState<number | null>(null);
  const [orderPresetType, setOrderPresetType] = useState<'LIMIT' | 'STOP_MARKET'>('LIMIT');
  
  // Interaction mode
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('default');

  /**
   * Open context menu at mouse position
   */
  const openCtxMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setCtxPosition({ x: e.clientX, y: e.clientY });
    setCtxOpen(true);
  }, []);

  /**
   * Close context menu
   */
  const closeCtxMenu = useCallback(() => {
    setCtxOpen(false);
    setCtxPosition(null);
  }, []);

  /**
   * Open order modal
   */
  const openOrderModal = useCallback((price: number, type: 'LIMIT' | 'STOP_MARKET') => {
    setOrderSeedPrice(price);
    setOrderPresetType(type);
    setOrderOpen(true);
    closeCtxMenu();
  }, [closeCtxMenu]);

  /**
   * Close order modal
   */
  const closeOrderModal = useCallback(() => {
    setOrderOpen(false);
    setOrderSeedPrice(null);
  }, []);

  /**
   * Open alert modal
   */
  const openAlertModal = useCallback(() => {
    setAlertOpen(true);
    closeCtxMenu();
  }, [closeCtxMenu]);

  /**
   * Close alert modal
   */
  const closeAlertModal = useCallback(() => {
    setAlertOpen(false);
  }, []);

  /**
   * Handle chart click events
   */
  const handleChartClick = useCallback((param: MouseEventParams) => {
    // Handle different interaction modes here
    // This is where you would implement drawing tools, etc.
    
    if (interactionMode === 'default') {
      // Default click behavior
      console.log('Chart clicked at:', param);
    }
  }, [interactionMode]);

  /**
   * Handle crosshair move events (hover)
   */
  const handleChartCrosshairMove = useCallback((param: MouseEventParams) => {
    if (!param.seriesData || param.seriesData.size === 0) {
      setHoverPrice(null);
      return;
    }
    
    // Get price from the first series
    const firstSeriesData = Array.from(param.seriesData.values())[0];
    if (firstSeriesData && 'close' in firstSeriesData) {
      setHoverPrice(firstSeriesData.close as number);
    }
  }, []);

  return {
    hoverPrice,
    setHoverPrice,
    ctxOpen,
    ctxPosition,
    openCtxMenu,
    closeCtxMenu,
    orderOpen,
    alertOpen,
    orderSeedPrice,
    orderPresetType,
    openOrderModal,
    closeOrderModal,
    openAlertModal,
    closeAlertModal,
    interactionMode,
    setInteractionMode,
    handleChartClick,
    handleChartCrosshairMove,
  };
}