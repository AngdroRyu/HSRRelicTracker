import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AddRelicView from '../views/AddRelicView.vue'
import ChartView from '../views/ChartView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: 'Home - HSRRelic Tracker' }, //titles for pages like so
    },
    {
      path: '/add-relic',
      name: 'RelicForm',
      component: AddRelicView,
      meta: { title: 'Add Relic - HSRRelic Tracker' },
    },
    {
      path: '/chart',
      name: 'Chart',
      component: ChartView,
      meta: { title: 'Relic Chart - HSRRelic Tracker' },
    },
  ],
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    } else {
      // always scroll to top
      return { top: 0 }
    }
  },
})
router.afterEach((to) => {
  if (to.meta && to.meta.title) {
    document.title = to.meta.title
  } else {
    document.title = 'HSRRelic Tracker'
  }
})

export default router
