import {connect} from 'react-redux';

const settings = props=>(
    <div>
        <p>Settings Page</p>
    </div>
);

export default connect(state=>state)(settings);
