import { Route } from 'front-end/lib/app/types';
import { Router } from 'front-end/lib/framework';

export function pushState(route: Route) {
  if (window.history && window.history.pushState) {
    const path = router.routeToUrl(route);
    window.history.pushState({ path }, '', path);
  }
}

export function replaceState(route: Route) {
  if (window.history && window.history.replaceState) {
    const path = router.routeToUrl(route);
    window.history.replaceState({ path }, '', path);
  }
}

export function redirect(path: string) {
  window.location.href = `${window.location.origin}/${path}`;
}

const router: Router<Route> = {

  routes: [
    {
      path: '/organizations',
      makeRoute() {
        return {
          tag: 'orgList',
          value: null
        };
      }
    },
    {
      path: '/organizations/:id/view',
      makeRoute({ params }) {
        return {
          tag: 'orgView',
          value: {
            orgId: params.id || ''
          }
        };
      }
    },
    {
      path: '/organizations/:id/edit',
      makeRoute({ params }) {
        return {
          tag: 'orgEdit',
          value: {
            orgId: params.id || ''
          }
        };
      }
    },
    {
      path: '/users/:id/edit',
      makeRoute({ params }) {
        return {
          tag: 'userEdit',
          value: {
            userId: params.id || ''
          }
        };
      }
    },
    {
      path: '/users/:id/view',
      makeRoute({ params }) {
        return {
          tag: 'userView',
          value: {
            userId: params.id || ''
          }
        };
      }
    },
    {
      path: '/users',
      makeRoute() {
        return {
          tag: 'userList',
          value: null
        };
      }
    },
    {
      path: '/',
      makeRoute() {
        return {
          tag: 'landing',
          value: null
        };
      }
    },
    {
      path: '/sign-in',
      makeRoute() {
        return {
          tag: 'signIn',
          value: null
        };
      }
    },
    {
      path: '/sign-out',
      makeRoute() {
        return {
          tag: 'signOut',
          value: null
        };
      }
    },
    {
      path: '/sign-up/step-one',
      makeRoute() {
        return {
          tag: 'signUpStepOne',
          value: null
        };
      }
    },
    {
      path: '/sign-up/step-two',
      makeRoute() {
        return {
          tag: 'signUpStepTwo',
          value: null
        };
      }
    },
    {
      path: '/notice/auth-failure',
      makeRoute() {
        return {
          tag: 'notice',
          value: {
            noticeId: {
              tag: 'authFailure',
              value: undefined
            }
          }
        };
      }
    },
    {
      path: '*',
      makeRoute() {
        return {
          tag: 'notice',
          value: {
            noticeId: {
              tag: 'notFound',
              value: undefined
            }
          }
        };
      }
    }
  ],

  routeToUrl(route) {
    switch (route.tag) {
      case 'landing':
        return '/';
      case 'signIn':
        return '/sign-in';
      case 'signOut':
        return '/sign-out';
      case 'signUpStepOne':
        return `/sign-up/step-one`;
      case 'signUpStepTwo':
        return `/sign-up/step-two`;
      case 'userEdit':
        return `/users/${route.value.userId}/edit`;
      case 'userView':
        return `/users/${route.value.userId}/view`;
      case 'userList':
        return '/users';
      case 'orgList':
        return '/organizations';
      case 'orgEdit':
        return `/organizations/${route.value.orgId}/edit`;
      case 'orgView':
        return `/organizations/${route.value.orgId}/view`;
      case 'notice':
        return (() => {
          switch (route.value.noticeId.tag) {
            case 'notFound':
              return '/not-found';
            case 'authFailure':
              return '/notice/auth-failure';
          }
        })();
    }
  }

};

export default router;
