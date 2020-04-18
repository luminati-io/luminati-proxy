// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, mocha:true*/
const assert = require('assert');
const changelog = require('../scripts/changelog_validate.js');

describe('changelog_validate', ()=>{
    const valid = {
        ver: 'REPLACE_VERSION',
        type: 'stable',
        changes: [{'type': 'bug', 'text': 'Fix'}],
    };
    it('should not throw on valid config', ()=>{
        assert.doesNotThrow(()=>changelog.t.validate([valid]));
    });
    it('should throw on invalid version type', ()=>{
        const clog = [Object.assign({}, valid, {type: 'random'})];
        assert.throws(()=>changelog.t.validate(clog),
            {message: 'Invalid changelog version type: random'});
    });
    it('should throw on empty changes', ()=>{
        const clog = [Object.assign({}, valid, {changes: []})];
        assert.throws(()=>changelog.t.validate(clog),
            {message: 'Changes in the latest changelog should be specified'});
    });
    it('should throw on changes with invalid type', ()=>{
        const clog = [Object.assign({}, valid,
            {changes: [{type: 'a', text: 'Fix'}]})];
        assert.throws(()=>changelog.t.validate(clog),
            {message: 'There are invalid changes in the latest changelog'});
    });
    it('should throw on changes without text', ()=>{
        const clog = [Object.assign({}, valid,
            {changes: [{type: 'bug', text: ''}]})];
        assert.throws(()=>changelog.t.validate(clog),
            {message: 'There are invalid changes in the latest changelog'});
    });
});
