// LICENSE_CODE ZON
'use strict'; /*jslint react:true*/
define(['react', 'react-dom', '/www/util/pub/pure_component.js',
    '/util/setdb.js', '/util/storage.js', '/util/url.js'],
    (React, ReactDOM, Pure_component, setdb, storage, zurl)=>{

// XXX saarya: change key once angular is removed
const storage_key = 'NG_TRANSLATE_LANG_KEY';
let path;
const init = (supported_lang, _path)=>{
    path = _path;
    setdb.set('i18n.config', {supported_lang, path: _path});
    const url_o = zurl.parse(document.location.href);
    const qs_o = zurl.qs_parse((url_o.search||'').substr(1));
    const lang = qs_o.hl||storage.get(storage_key);
    if (lang)
        set_curr_lang(lang);
};
const set_curr_lang = lang=>{
    storage.set(storage_key, lang);
    setdb.set('i18n.curr_lang', lang);
    require(['text!'+path+'/'+lang],
        translation=>setdb.set('i18n.translation', JSON.parse(translation)),
        ()=>{
            setdb.set('i18n.translation', null),
            console.error('error loading translation for '+lang);
        }
    );
};
class T extends Pure_component {
    constructor(props){
        super(props);
        this.key = props.children.replace(/\s+/g, ' ');
        this.state = {text: this.key};
    }
    componentWillMount(){
        this.setdb_on('i18n.translation', translation=>{
            if (!translation)
                return this.setState({text: this.key});
            if (!translation[this.key])
                return console.info('Missing translation for: "'+this.key+'"');
            this.setState({text: translation[this.key]});
        });
    }
    render(){ return this.state.text; }
}

const E = {T, init, set_curr_lang};
return E;

});
