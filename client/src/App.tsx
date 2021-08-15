import { BrowserRouter as Router, Route } from 'react-router-dom';
import './App.css';
import SearchKeywords from './search-keywords/SearchKeywords';
import Unauthorized from './unauthorized/Unauthorized';
import ProtectedRoute from './ProtectedRoute';

import '@fontsource/roboto';


function App() {
  return (
    <Router>
      <ProtectedRoute exact path="/" component={SearchKeywords} />
      <Route path="/unauthorized" component={Unauthorized} />
    </Router>
  );
}

export default App;
