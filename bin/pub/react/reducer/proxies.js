export default (state = [], action)=>{
    if (action.type=='proxies')
        return action.proxies;
    return state;
};
