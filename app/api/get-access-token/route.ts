const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

export async function POST() {
  try {
    if (!HEYGEN_API_KEY) {
      throw new Error("API key is missing from .env");
    }
    const baseApiUrl = process.env.NEXT_PUBLIC_BASE_API_URL || "https://api.heygen.com";

    const res = await fetch(`${baseApiUrl}/v1/streaming.create_token`, {
      method: "POST",
      headers: {
        "x-api-key": HEYGEN_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({}) // Add empty body to ensure proper request format
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error("Token creation failed:", {
        status: res.status,
        statusText: res.statusText,
        errorData
      });
      throw new Error(`Failed to create token: ${res.status} ${JSON.stringify(errorData)}`);
    }

    const data = await res.json();
    
    if (!data.data?.token) {
      throw new Error("No token received in response");
    }

    return new Response(data.data.token, {
      status: 200,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  } catch (error) {
    console.error("Error retrieving access token:", error);
    return new Response(error instanceof Error ? error.message : "Failed to retrieve access token", {
      status: 500,
      headers: {
        "Content-Type": "text/plain"
      }
    });
  }
}
