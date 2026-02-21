/**
 * client.js — Frontend API client for PayBack backend.
 * Base URL from import.meta.env.VITE_API_BASE_URL (set in frontend/.env).
 * TODO: Implement uploadBill(file), getAnalysisResult(billId), buildDisputeCase(billId, selectedFlagIds), sendDisputeEmail(caseId, recipient).
 */

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function uploadBill(file) {
  const formData = new FormData();
  formData.append('file', file);

  let response;
  try {
    response = await fetch(`${baseURL}/bills/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    throw new Error('Unable to reach backend. Please try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail || 'Upload failed. Please try another file.';
    throw new Error(message);
  }

  return payload;
}

export const api = {
  baseURL,
  uploadBill,
  // getAnalysisResult(billId) -> { decoded, flags, ... }
  // buildDisputeCase(billId, selectedFlagIds) -> { caseId, letterPreview, ... }
  // sendDisputeEmail(caseId, recipient) -> { sent: true }
};
