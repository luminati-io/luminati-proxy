// LICENSE_CODE ZON
'use strict'; /*jslint node:true, react:true*/
var define;
var is_node = typeof module=='object' && module.exports;
if (is_node)
    define = require('../../../util/require_node.js').define(module, '..');
else
    define = self.define;

define(['react', 'react-dom', '/www/util/pub/pure_component.js',
    '/util/setdb.js', '/www/locale/pub/i18n.js'],
    (React, ReactDOM, Pure_component, setdb, i18n)=>
{
const {t} = i18n;
const Wrap = ({children})=>children;
class T extends Pure_component {
    constructor(props){
        super(props);
        this.state = {};
    }
    componentDidMount(){
        this.setdb_on('i18n.translation', translation=>
            this.setState({translation}));
    }
    render(){
        const {translation} = this.state;
        const {children} = this.props;
        let result = '';
        if (typeof children=='function')
            result = children(key=>t(key, translation));
        else if (typeof children=='string')
            result = t(children.replace(/\s+/g, ' '), translation);
        else
        {
            console.error('<T> must receive text to translate or a translate '
                +'function. Received: ', this.props.children);
        }
        return <Wrap>{result}</Wrap>;
    }
}
const E = {T};
return E;

});
