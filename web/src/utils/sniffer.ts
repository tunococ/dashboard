export async function fetchMimeType(url: string | URL) {
  const response = await fetch(url, {
    method: "HEAD", // Specify the HEAD method
  });

  if (!response.ok) {
    throw new Error(
      `failed to fetch MIME type from URL ${url} -- ` +
        `HTTP error: ${response.status}`,
    );
  }

  const contentType = response.headers.get("Content-Type");
  return contentType;
}
