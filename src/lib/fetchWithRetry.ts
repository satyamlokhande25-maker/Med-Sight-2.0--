/**
 * Retries a fetch request if it fails or returns a non-JSON response (if expected).
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {}, 
  retries = 2, 
  delay = 1000,
  expectJson = true,
  timeout = 60000 // Default 60s timeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    
    // If the response is OK
    if (response.ok) {
      // If we expect JSON, check the content type
      if (expectJson) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return response;
        }
        
        // If not JSON but we expected it, and we have retries, fall through to retry logic
        if (retries > 0) {
          console.warn(`Fetch for ${url} returned non-JSON content type: ${contentType}. Retrying...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchWithRetry(url, options, retries - 1, delay * 2, expectJson);
        }
        
        // If no retries left, throw a descriptive error instead of returning the HTML response
        const text = await response.text();
        console.error(`Expected JSON from ${url} but received:`, text.substring(0, 200));
        throw new Error(`Server returned an unexpected response format (not JSON) from ${url}. This often happens if the server is restarting or misconfigured.`);
      } else {
        // If we don't strictly expect JSON, return the OK response
        return response;
      }
    }
    
    // If we have retries left, wait and try again
    if (retries > 0) {
      console.warn(`Fetch failed for ${url} (${response.status}). Retrying in ${delay}ms... (${retries} left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2, expectJson);
    }
    
    // If no retries left and it's an error response, try to parse JSON error if possible
    // but if it's HTML, throw a descriptive error
    const contentType = response.headers.get("content-type");
    if (expectJson && contentType && !contentType.includes("application/json")) {
      const text = await response.text();
      console.error(`Error response from ${url} (${response.status}) is not JSON:`, text.substring(0, 200));
      throw new Error(`Server error (${response.status}) from ${url}. The response was not in the expected JSON format.`);
    }
    
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (retries > 0) {
      console.warn(`Fetch error for ${url}. Retrying in ${delay}ms... (${retries} left)`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 2, expectJson);
    }
    throw error;
  }
}
