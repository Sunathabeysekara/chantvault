/**
 * Client-Side Privacy-Respecting Analytics & Usage Tracker
 * Logs page views and popular option interactions to the persistent database
 */

// Generate or retrieve anonymous session ID for this browser tab/session
export function getAnonymousSessionId(): string {
  try {
    let sess = sessionStorage.getItem('cv_anon_session_id');
    if (!sess) {
      sess = 'anon_sess_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36).substring(4);
      sessionStorage.setItem('cv_anon_session_id', sess);
    }
    return sess;
  } catch (e) {
    return 'anon_sess_client';
  }
}

export interface InteractionPayload {
  category: 'topic_filter' | 'sort_filter' | 'search_query' | 'group_action' | 'helpline_action' | 'privacy_action' | 'navigation';
  action_target: string;
  label?: string;
}

/**
 * Track a page visit or active tab navigation
 */
export async function trackPageView(
  path: string,
  pageName: string,
  optionName?: string,
  interaction?: InteractionPayload
) {
  try {
    const sessionId = getAnonymousSessionId();
    const payload = {
      path,
      page_name: pageName,
      option_name: optionName || null,
      session_id: sessionId,
      referrer: document.referrer || 'direct',
      user_agent: navigator.userAgent || '',
      interaction: interaction || null
    };

    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      // Non-blocking silent fail
    });
  } catch (e) {
    // Non-blocking
  }
}

/**
 * Track user interaction with specific popular options, topics, search queries
 */
export async function trackInteraction(
  category: InteractionPayload['category'],
  actionTarget: string,
  label: string
) {
  try {
    const sessionId = getAnonymousSessionId();
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        page_name: document.title || 'Public Sanctuary',
        session_id: sessionId,
        interaction: {
          category,
          action_target: actionTarget,
          label
        }
      }),
      keepalive: true
    }).catch(() => {
      // Non-blocking silent fail
    });
  } catch (e) {
    // Non-blocking
  }
}
