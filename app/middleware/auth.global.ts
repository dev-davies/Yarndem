export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/login') return

  const accessToken = useCookie<string | null>('access_token')
  if (!accessToken.value) {
    return navigateTo('/login')
  }
})
