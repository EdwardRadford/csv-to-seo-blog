// One URL per page: "/report/" permanently redirects to "/report", keeping any query string.
export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    return sendRedirect(event, url.pathname.replace(/\/+$/, '') + url.search, 301)
  }
})
