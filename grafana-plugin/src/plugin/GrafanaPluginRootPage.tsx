import React, { useEffect } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import classnames from 'classnames';
import { observer, Provider } from 'mobx-react';
import Header from 'navbar/Header/Header';
import LegacyNavTabsBar from 'navbar/LegacyNavTabsBar';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';
import { AppRootProps } from 'types';

import RenderConditionally from 'components/RenderConditionally/RenderConditionally';
import Unauthorized from 'components/Unauthorized';
import DefaultPageLayout from 'containers/DefaultPageLayout/DefaultPageLayout';
import { getMatchedPage, getRoutesForPage, pages } from 'pages';
import NoMatch from 'pages/NoMatch';
import EscalationChains from 'pages/escalation-chains/EscalationChains';
import Incident from 'pages/incident/Incident';
import Incidents from 'pages/incidents/Incidents';
import Insights from 'pages/insights/Insights';
import Integration from 'pages/integration/Integration';
import Integrations from 'pages/integrations/Integrations';
import OutgoingWebhooks from 'pages/outgoing_webhooks/OutgoingWebhooks';
import Schedule from 'pages/schedule/Schedule';
import Schedules from 'pages/schedules/Schedules';
import SettingsPage from 'pages/settings/SettingsPage';
import ChatOps from 'pages/settings/tabs/ChatOps/ChatOps';
import CloudPage from 'pages/settings/tabs/Cloud/CloudPage';
import LiveSettings from 'pages/settings/tabs/LiveSettings/LiveSettingsPage';
import Users from 'pages/users/Users';
import { rootStore } from 'state';
import { useStore } from 'state/useStore';
import { isUserActionAllowed } from 'utils/authorization';
import { DEFAULT_PAGE } from 'utils/consts';

import 'assets/style/vars.css';
import 'assets/style/global.css';
import 'assets/style/utils.css';

import { getQueryParams, isTopNavbar } from './GrafanaPluginRootPage.helpers';
import PluginSetup from './PluginSetup';

import grafanaGlobalStyle from '!raw-loader!assets/style/grafanaGlobalStyles.css';

export const GrafanaPluginRootPage = (props: AppRootProps) => {
  return (
    <Provider store={rootStore}>
      <PluginSetup InitializedComponent={Root} {...props} />
    </Provider>
  );
};

export const Root = observer((props: AppRootProps) => {
  const { isBasicDataLoaded, loadBasicData, loadMasterData, pageTitle } = useStore();

  const location = useLocation();

  useEffect(() => {
    loadBasicData();
    // defer loading master data as it's not used in first sec by user in order to prioritize fetching base data
    const timeout = setTimeout(() => {
      loadMasterData();
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    let link = document.createElement('link');
    link.type = 'text/css';
    link.rel = 'stylesheet';

    // create a style element
    const styleEl = document.createElement('style');
    const head = document.head || document.getElementsByTagName('head')[0];
    styleEl.appendChild(document.createTextNode(grafanaGlobalStyle));

    // append grafana overriding styles to head
    head.appendChild(styleEl);

    document.head.appendChild(link);

    return () => {
      head.removeChild(styleEl); // remove on unmount
    };
  }, []);

  const page = getMatchedPage(location.pathname);
  const pagePermissionAction = pages[page]?.action;
  const userHasAccess = pagePermissionAction ? isUserActionAllowed(pagePermissionAction) : true;
  const query = getQueryParams();

  const getPageNav = () => {
    return (pages[page] || pages[DEFAULT_PAGE]).getPageNav(pageTitle);
  };

  if (!userHasAccess) {
    return <Unauthorized requiredUserAction={pagePermissionAction} />;
  }

  return (
    <DefaultPageLayout {...props} page={page} pageNav={getPageNav()}>
      {!isTopNavbar() && (
        <>
          <Header />
          <LegacyNavTabsBar currentPage={page} />
        </>
      )}

      <div
        className={classnames('u-position-relative', 'u-flex-grow-1', {
          'u-overflow-x-auto': !isTopNavbar(),
          'page-body': !isTopNavbar(),
        })}
      >
        <RenderConditionally
          shouldRender={userHasAccess}
          backupChildren={<Unauthorized requiredUserAction={pagePermissionAction} />}
        >
          <RenderConditionally
            shouldRender={isBasicDataLoaded}
            backupChildren={<LoadingPlaceholder text="Loading..." />}
          >
            <Switch>
              <Route path={getRoutesForPage('alert-groups')} exact>
                <Incidents query={query} />
              </Route>
              <Route path={getRoutesForPage('alert-group')} exact>
                <Incident query={query} />
              </Route>
              <Route path={getRoutesForPage('users')} exact>
                <Users query={query} />
              </Route>
              <Route path={getRoutesForPage('integrations')} exact>
                <Integrations query={query} />
              </Route>
              <Route path={getRoutesForPage('integration')} exact>
                <Integration query={query} />
              </Route>
              <Route path={getRoutesForPage('escalations')} exact>
                <EscalationChains query={query} />
              </Route>
              <Route path={getRoutesForPage('schedules')} exact>
                <Schedules query={query} />
              </Route>
              <Route path={getRoutesForPage('schedule')} exact>
                <Schedule query={query} />
              </Route>
              <Route path={getRoutesForPage('outgoing_webhooks')} exact>
                <OutgoingWebhooks query={query} />
              </Route>
              <Route path={getRoutesForPage('settings')} exact>
                <SettingsPage />
              </Route>
              <Route path={getRoutesForPage('chat-ops')} exact>
                <ChatOps query={query} />
              </Route>
              <Route path={getRoutesForPage('live-settings')} exact>
                <LiveSettings />
              </Route>
              <Route path={getRoutesForPage('cloud')} exact>
                <CloudPage />
              </Route>
              <Route path={getRoutesForPage('insights')} exact>
                <Insights />
              </Route>

              {/* Backwards compatibility redirect routes */}
              <Route
                path={getRoutesForPage('incident')}
                exact
                render={({ location }) => (
                  <Redirect
                    to={{
                      ...location,
                      pathname: location.pathname.replace(/incident/, 'alert-group'),
                    }}
                  ></Redirect>
                )}
              />
              <Route
                path={getRoutesForPage('incidents')}
                exact
                render={({ location }) => (
                  <Redirect
                    to={{
                      ...location,
                      pathname: location.pathname.replace(/incidents/, 'alert-groups'),
                    }}
                  ></Redirect>
                )}
              />
              <Route path="*">
                <NoMatch />
              </Route>
            </Switch>
          </RenderConditionally>
        </RenderConditionally>
      </div>
    </DefaultPageLayout>
  );
});
