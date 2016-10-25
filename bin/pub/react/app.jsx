require('bootstrap/dist/css/bootstrap.min.css');
require('../app.css');
import {render} from 'react-dom';
import {Router, Route, IndexRedirect, hashHistory, Link} from 'react-router';
import {createStore, combineReducers} from 'redux';  
import {Provider, connect} from 'react-redux';
import reducer from './reducer';
import settings from './settings.jsx';

const store = createStore(combineReducers(reducer));
const app = connect()(props=>(
    <div>
        <div className='header'>
            <div className='container'>
                <img src='/img/menu_logo.svg' />
            </div>
        </div>
            <ol className='breadcrumb'>
                <li><Link to='/'>Username</Link></li>
                <li><Link to='/settings'>Route</Link></li>
            </ol>
        <div className='container'>
            {props.children}
        </div>
    </div>
));

render((
    <Provider store={store}>
        <Router history={hashHistory}>
            <Route path='/' component={app}>
                <IndexRedirect to='/settings' />
                <Route path='settings' component={settings} />
            </Route>
        </Router>
    </Provider>
), document.getElementById('app'));
