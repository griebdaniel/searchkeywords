import {  useState } from "react";
import { Redirect, Route } from "react-router-dom";
import { genericService } from './services/GenericService';

import { isNil } from 'lodash';

const ProtectedRoute = ({ component: Component, ...props }: any) => {
  const serverUrl = process.env.REACT_APP_SERVER_URL;

  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  const authenticate = async () => {
    // const isAuthenticated = (await axios.get<boolean>(`${serverUrl}/user/logged`, { withCredentials: true })).data;

    // const isAuthenticated = true;

    const loggedInUser = await genericService.getLoggedInUser();

    if (loggedInUser) {
      setAuthenticated(true);
    } else {
      window.location.href = serverUrl + '/auth/google';
    }
  };

  authenticate();

  return (
    <div>
      {
        !isNil(authenticated) &&
        <Route
          {...props}
          render={(props) =>
            authenticated ? <Component {...props} /> : <Redirect to="/unauthorized" />
          }
        />
      }
    </div>
  );
};

export default ProtectedRoute;