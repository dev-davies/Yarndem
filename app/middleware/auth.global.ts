export default defineNuxtRouteMiddleware((to) => {
  const publicRoutes = ['/login', '/signup']
  if (publicRoutes.includes(to.path)) return

  const accessToken = useCookie<string | null>('access_token')
  if (!accessToken.value) {
    return navigateTo('/login')
  }
})
