/**
 * Grid thumbnails: lazy load + async decode. Full file_url (no CDN resize in schema).
 */
export function gridImageProps(url, alt = '') {
  return {
    src: url,
    alt,
    loading: 'lazy',
    decoding: 'async',
  };
}
