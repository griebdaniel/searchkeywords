import React from 'react';
import { genericService } from '../services/GenericService';

const Unauthorized = () => {

  genericService.getLoggedInUser().then(user => {
    if (user && user.status === 'ACTIVE') {
      window.location.href = '/';
    }
  });

  return (
    <h1>
      You're not authorized to access this page.
    </h1>
  );
};

export default Unauthorized;
