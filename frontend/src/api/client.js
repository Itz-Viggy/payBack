/**
 * client.js — Frontend API client for PayBack backend.
 * Base URL from import.meta.env.VITE_API_BASE_URL (set in frontend/.env).
 * TODO: Implement uploadBill(file), getAnalysisResult(billId), buildDisputeCase(billId, selectedFlagIds), sendDisputeEmail(caseId, recipient).
 */

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const api = {
  baseURL,
  // uploadBill(file) -> { billId }
  // getAnalysisResult(billId) -> { decoded, flags, ... }
  // buildDisputeCase(billId, selectedFlagIds) -> { caseId, letterPreview, ... }
  // sendDisputeEmail(caseId, recipient) -> { sent: true }
};
