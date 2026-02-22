/**
 * client.js — Frontend API client for PayBack backend.
 * Base URL from import.meta.env.VITE_API_BASE_URL (set in frontend/.env).
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

/**
 * Fetch all bill analyses joined with their dispute statuses.
 * Returns array of { id, file_id, hospital_name, total_billed,
 *   estimated_overcharge, extracted_codes, standard_charges,
 *   billed_charges, status, created_at, updated_at }
 */
async function getHistory() {
  const response = await fetch(`${baseURL}/api/history/all`);
  if (!response.ok) {
    throw new Error('Failed to fetch history.');
  }
  return response.json();
}

/**
 * Update the dispute status for a given analysis.
 * @param {string} analysisId - The bill_analysis ObjectId string.
 * @param {string} status - One of: pending, email_sent, waiting_response, denied, success, closed.
 */
async function updateStatus(analysisId, status) {
  const response = await fetch(`${baseURL}/api/history/status/${analysisId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    throw new Error('Failed to update status.');
  }
  return response.json();
}

async function getPrecedents(billId, topK = 5) {
  let response;
  try {
    response = await fetch(`${baseURL}/bills/${billId}/precedents?top_k=${topK}`);
  } catch (error) {
    throw new Error('Unable to reach backend for precedent search.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail || 'Precedent search failed.';
    throw new Error(message);
  }

  return payload;
}

/**
 * Search precedents by free-form query (e.g. built from selected line items).
 * Returns { precedents: [ { id, score, payload } ] }
 */
async function searchPrecedents(query, topK = 5) {
  let response;
  try {
    response = await fetch(`${baseURL}/precedents/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK }),
    });
  } catch (error) {
    throw new Error('Unable to reach backend for precedent search.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.detail || 'Precedent search failed.';
    throw new Error(message);
  }

  return payload;
}

export const api = {
  baseURL,
  uploadBill,
  getHistory,
  updateStatus,
  getPrecedents,
  searchPrecedents,
  // getAnalysisResult(billId) -> { decoded, flags, ... }
  // buildDisputeCase(billId, selectedFlagIds) -> { caseId, letterPreview, ... }
  // sendDisputeEmail(caseId, recipient) -> { sent: true }
};
