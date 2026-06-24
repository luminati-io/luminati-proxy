// LICENSE_CODE ZON ISC
'use strict'; /*jslint node:true, react:true, esnext:true*/

import _ from 'lodash4';
import * as acorn from 'acorn';

export class Js_sanitizer_error extends Error {
    constructor(msg, node){
        const pos = node && node.loc && node.loc.start;
        super('JS sanitize error: '+msg+
            (pos ? ` at ${pos.line}:${pos.column}` : ''));
        this.name = 'Js_sanitizer_error';
        this.code = 'CODE_UNSAFE';
    }
}

const COMPUTED = '<computed>';
const UNKNOWN = '<unknown>';
const is_opaque = value=>value===COMPUTED || value===UNKNOWN;

const FUNCTION_NODES = new Set([
    'FunctionDeclaration',
    'FunctionExpression',
    'ArrowFunctionExpression',
]);
const CLASS_NODES = new Set([
    'ClassDeclaration',
    'ClassExpression',
]);
const IMPORT_BINDING_NODES = new Set([
    'ImportSpecifier',
    'ImportDefaultSpecifier',
    'ImportNamespaceSpecifier',
]);
const SCOPE_NODE_TYPES = new Set([
    'Program',
    'BlockStatement',
    'ForStatement',
    'CatchClause',
    ...FUNCTION_NODES,
]);
const SKIP_KEYS = new Set([
    'type',
    'start',
    'end',
    'loc',
    'range',
    'parent',
]);

const make_policy = ()=>({
    default_allow: true,
    allow: new Set(),
    forbid: new Set(),
});

const set_default = (policy, allow)=>{
    policy.default_allow = allow;
    policy.allow.clear();
    policy.forbid.clear();
};

const add_allow = (policy, values)=>values.forEach(v=>{
    policy.allow.add(v);
    policy.forbid.delete(v);
});

const add_forbid = (policy, values)=>values.forEach(v=>{
    policy.forbid.add(v);
    policy.allow.delete(v);
});

const check_policy = (policy, value)=>{
    if (_.isNil(value))
        return true;
    if (is_opaque(value))
    {
        if (policy.forbid.has(value))
            return false;
        if (!policy.default_allow)
            return false;
        if (policy.forbid.size)
            return false;
        return true;
    }
    if (policy.forbid.has(value))
        return false;
    if (!policy.default_allow && !policy.allow.has(value))
        return false;
    return true;
};

const to_list = (name, value)=>{
    if (_.isNil(value))
        return [];
    const list = value instanceof Set ? [...value] : _.castArray(value);
    if (!list.every(v=>_.isString(v) && v))
        throw new Js_sanitizer_error(`bad ${name} list`);
    return list;
};

export const prop_name = node=>{
    if (!node)
        return;
    if (node.type=='Identifier')
        return node.name;
    if (node.type=='Literal')
        return String(node.value);
};

const member_path = node=>{
    if (!node)
        return;
    if (node.type=='Identifier')
        return node.name;
    if (node.type=='ThisExpression')
        return 'this';
    if (node.type=='MemberExpression' && !node.computed)
    {
        const obj = member_path(node.object);
        const p = prop_name(node.property);
        if (obj && p)
            return `${obj}.${p}`;
    }
};

export const member_name = node=>{
    if (!node || node.type!='MemberExpression')
        return;
    if (node.computed)
        return COMPUTED;
    const p = prop_name(node.property);
    if (!p)
        return COMPUTED;
    const path = member_path(node);
    if (path)
        return path;
    return p;
};

const callable_name = node=>{
    if (!node)
        return;
    if (node.type=='Identifier')
        return node.name;
    if (node.type=='MemberExpression')
        return member_name(node);
    if (node.type=='ChainExpression')
        return callable_name(node.expression);
    return UNKNOWN;
};

export const call_name = node=>{
    if (!node)
        return;
    if (node.type=='CallExpression' || node.type=='OptionalCallExpression')
        return callable_name(node.callee);
};

export const new_name = node=>{
    if (!node || node.type!='NewExpression')
        return;
    return callable_name(node.callee);
};

const is_non_computed_member_property = (node, parent)=>parent &&
    parent.type=='MemberExpression' && parent.property===node &&
    !parent.computed;

const is_object_property_key = (node, parent, grandparent)=>parent &&
    parent.type=='Property' && parent.key===node && !parent.computed &&
    grandparent && grandparent.type=='ObjectExpression';

const is_function_name = (node, parent)=>parent &&
    FUNCTION_NODES.has(parent.type) && parent.id===node;

const is_class_name = (node, parent)=>parent &&
    CLASS_NODES.has(parent.type) && parent.id===node;

const is_function_param = (node, parent)=>parent &&
    FUNCTION_NODES.has(parent.type) && parent.params.includes(node);

const is_import_binding = (node, parent)=>parent &&
    IMPORT_BINDING_NODES.has(parent.type) && parent.local===node;

const is_variable_binding = (node, parent)=>parent &&
    parent.type=='VariableDeclarator' && parent.id===node;

export const is_identifier_reference = (node, parent, grandparent)=>{
    if (!node || node.type!='Identifier')
        return false;
    if (is_non_computed_member_property(node, parent))
        return false;
    if (is_object_property_key(node, parent, grandparent))
        return false;
    if (is_function_name(node, parent))
        return false;
    if (is_class_name(node, parent))
        return false;
    if (is_function_param(node, parent))
        return false;
    if (is_variable_binding(node, parent))
        return false;
    if (is_import_binding(node, parent))
        return false;
    return true;
};

const make_scope = parent=>({
    parent,
    bindings: new Set(),
});

const add_binding = (scope, node)=>{
    if (!scope || !node || node.type!='Identifier')
        return;
    scope.bindings.add(node.name);
};

const add_pattern_binding = (scope, node)=>{
    if (!node)
        return;
    if (node.type=='Identifier')
        return add_binding(scope, node);
    if (node.type=='AssignmentPattern')
        return add_pattern_binding(scope, node.left);
};

const add_var_decl_bindings = (scope, node)=>{
    if (!node || node.type!='VariableDeclaration')
        return;
    for (const decl of node.declarations)
        add_pattern_binding(scope, decl.id);
};

const add_function_bindings = (scope, node)=>{
    if (!node || !FUNCTION_NODES.has(node.type))
        return;
    if (node.id)
        add_binding(scope, node.id);
    for (const param of node.params||[])
        add_pattern_binding(scope, param);
};

const collect_body_declarations = (scope, node)=>{
    if (!node || !Array.isArray(node.body))
        return;
    for (const stmt of node.body)
    {
        if (stmt.type=='FunctionDeclaration')
            add_binding(scope, stmt.id);
        else if (stmt.type=='VariableDeclaration')
            add_var_decl_bindings(scope, stmt);
    }
};

const collect_scope_bindings = (scope, node)=>{
    if (!scope || !node)
        return;
    if (node.type=='Program' || node.type=='BlockStatement')
        collect_body_declarations(scope, node);
    else if (FUNCTION_NODES.has(node.type))
        add_function_bindings(scope, node);
    else if (node.type=='ForStatement')
    {
        if (node.init && node.init.type=='VariableDeclaration')
            add_var_decl_bindings(scope, node.init);
    }
    else if (node.type=='CatchClause')
        add_pattern_binding(scope, node.param);
};

const is_scope_node = node=>!!node && SCOPE_NODE_TYPES.has(node.type);

export const scope_binding_scope = (scope, name)=>{
    for (let s = scope; s; s = s.parent)
    {
        if (s.bindings.has(name))
            return s;
    }
};

export const is_global_identifier_reference =
(node, parent, grandparent, scope)=>
    is_identifier_reference(node, parent, grandparent) &&
    !scope_binding_scope(scope, node.name);

const climb_member_root = (g, ancestors)=>{
    let node = g;
    let i = ancestors.length-1; // ancestors[i] === g
    while (i>0)
    {
        const p = ancestors[i-1];
        if (p.type=='MemberExpression' && p.object===node
            || p.type=='ChainExpression' && p.expression===node)
        {
            node = p;
            i--;
            continue;
        }
        break;
    }
    return {top: node, parent: ancestors[i-1]};
};

const WRITE_PARENT = {
    AssignmentExpression: (p, top)=>p.left===top,
    UpdateExpression: (p, top)=>p.argument===top,
    UnaryExpression: (p, top)=>p.operator=='delete' && p.argument===top,
};

const is_alias_position = (p, top)=>{
    switch (p.type)
    {
    case 'VariableDeclarator':
        return p.init===top;
    case 'AssignmentExpression':
        return p.right===top;
    case 'AssignmentPattern':
        return p.right===top;
    case 'Property':
        return p.value===top;
    case 'ArrayExpression':
        return true;
    case 'ReturnStatement':
        return p.argument===top;
    case 'ArrowFunctionExpression':
        return p.body===top;
    default:
        return false;
    }
};

const classify_global_ref = (node, parent, grandparent, scope, ancestors)=>{
    if (!is_global_identifier_reference(node, parent, grandparent, scope))
        return;
    if (!ancestors || ancestors[ancestors.length-1]!==node)
        return;
    const {top, parent: p} = climb_member_root(node, ancestors);
    if (!p)
        return;
    const write = WRITE_PARENT[p.type];
    if (write && write(p, top))
        return {kind: 'mutation', name: node.name};
    if (is_alias_position(p, top))
        return {kind: 'alias', name: node.name};
};

const aspect_value = {
    nodes: node=>node.type,
    identifiers: (node, parent, grandparent)=>{
        if (!is_identifier_reference(node, parent, grandparent))
            return;
        return node.name;
    },
    props: node=>{
        if (node.type!='MemberExpression')
            return;
        if (!node.computed)
            return prop_name(node.property) || COMPUTED;
        if (node.property.type=='Literal')
            return prop_name(node.property);
        return COMPUTED;
    },
    calls: node=>{
        if (node.type!='CallExpression'
            && node.type!='OptionalCallExpression')
        {
            return;
        }
        return call_name(node);
    },
    new_expr: node=>{
        if (node.type!='NewExpression')
            return;
        return new_name(node);
    },
    unary_ops: node=>{
        if (node.type!='UnaryExpression')
            return;
        return node.operator;
    },
    binary_ops: node=>{
        if (node.type!='BinaryExpression')
            return;
        return node.operator;
    },
    logical_ops: node=>{
        if (node.type!='LogicalExpression')
            return;
        return node.operator;
    },
    assignment_ops: node=>{
        if (node.type!='AssignmentExpression')
            return;
        return node.operator;
    },
    update_ops: node=>{
        if (node.type!='UpdateExpression')
            return;
        return node.operator;
    },
    global_mutation: (node, parent, grandparent, scope, ancestors)=>{
        const r = classify_global_ref(node, parent, grandparent, scope,
            ancestors);
        if (r && r.kind=='mutation')
            return r.name;
    },
    global_alias: (node, parent, grandparent, scope, ancestors)=>{
        const r = classify_global_ref(node, parent, grandparent, scope,
            ancestors);
        if (r && r.kind=='alias')
            return r.name;
    },
};

// Full AST walk that visits EVERY node, so forbid() can block everything.
const walk_all = (root, cb)=>{
    const visit = (node, ancestors, scope)=>{
        if (!node || typeof node!='object' || typeof node.type!='string')
            return;
        if (is_scope_node(node))
        {
            scope = make_scope(scope);
            collect_scope_bindings(scope, node);
        }
        ancestors.push(node);
        cb(node, ancestors, scope);
        for (const key in node)
        {
            if (SKIP_KEYS.has(key))
                continue;
            const child = node[key];
            if (Array.isArray(child))
            {
                for (const el of child)
                    visit(el, ancestors, scope);
            }
            else if (child && typeof child=='object'
                && typeof child.type=='string')
            {
                visit(child, ancestors, scope);
            }
        }
        ancestors.pop();
    };
    visit(root, [], null);
};

export default class Js_sanitizer {
    constructor(opt={}){
        const {
            validate_shape,
            node_validators=[],
            max_code_len=10000,
            parse_opt={},
        } = opt;
        if (validate_shape && !_.isFunction(validate_shape))
            throw new Js_sanitizer_error('bad shape validator');
        if (!_.isArray(node_validators)
            || !node_validators.every(_.isFunction))
        {
            throw new Js_sanitizer_error('bad node validators');
        }
        if (!Number.isFinite(max_code_len) || max_code_len<=0)
            throw new Js_sanitizer_error('bad max code length');
        this.validate_shape = validate_shape || _.noop;
        this.node_validators = [...node_validators];
        this.max_code_len = max_code_len;
        this.parse_opt = _.defaults({}, parse_opt, {
            ecmaVersion: 2020,
            sourceType: 'script',
            locations: true,
        });
        // Fresh, fully-open policies. Until forbid()/allow() is called, the
        // built-in policies impose NO restrictions — only the supplied
        // node_validators / validate_shape run.
        this.policies = _.mapValues(aspect_value, make_policy);
    }
    fail(msg, node){
        throw new Js_sanitizer_error(msg, node);
    }
    #normalize_spec(spec){
        // Short form -> node types.
        if (_.isString(spec) || _.isArray(spec) || spec instanceof Set)
            return {nodes: to_list('nodes', spec)};
        if (!_.isPlainObject(spec))
            throw new Js_sanitizer_error('bad sanitizer policy spec');
        return _.mapValues(spec, (value, aspect)=>{
            if (!this.policies[aspect])
            {
                throw new Js_sanitizer_error(
                    `unknown sanitizer aspect ${aspect}`);
            }
            if (value===true)
                return true;
            return to_list(aspect, value);
        });
    }
    #apply_policy_spec(spec, allow){
        const normalized = this.#normalize_spec(spec);
        _.forOwn(normalized, (value, aspect)=>{
            const policy = this.policies[aspect];
            if (value===true)
                return set_default(policy, allow);
            if (allow)
                add_allow(policy, value);
            else
                add_forbid(policy, value);
        });
        return this;
    }
    /**
     * forbid()
     *   ANY code fails. Every AST node is blocked until you re-enable parts
     *   with allow([...]).
     *
     * forbid(['WithStatement', 'ImportDeclaration'])
     *   Blocks only the listed node types.
     *
     * forbid({identifiers: ['process', 'require'], props: ['constructor']})
     *   Partial block by aspect.
     *
     * forbid({new_expr: true})
     *   Blocks all `new ...` expressions.
     *
     * forbid({global_mutation: true, global_alias: true})
     *   Blocks writing through / capturing host (external) globals. Names the
     *   sanitized code declares itself remain mutable and aliasable.
     */
    forbid(...args){
        if (!args.length)
        {
            set_default(this.policies.nodes, false);
            return this;
        }
        if (args.length>1)
            throw new Js_sanitizer_error('too many forbid arguments');
        return this.#apply_policy_spec(args[0], false);
    }
    /**
     * allow()
     *   Re-opens all AST node types.
     *
     * allow(['Program', 'FunctionDeclaration'])
     *   Allows the listed node types (use after forbid()).
     *
     * allow({new_expr: ['RegExp']})
     *   Allows selected new-expressions.
     *
     * allow({identifiers: true})
     *   Allows all identifier references by default.
     *
     * Note: allow({props: ['<computed>']}) does not re-enable dynamic
     * computed property access when a props forbid-list is active. Opaque
     * computed properties (for example obj[key] or obj['con'+'structor']) are
     * still rejected in that case to prevent bypassing forbidden properties.
     */
    allow(...args){
        if (!args.length)
        {
            set_default(this.policies.nodes, true);
            return this;
        }
        if (args.length>1)
            throw new Js_sanitizer_error('too many allow arguments');
        return this.#apply_policy_spec(args[0], true);
    }
    /**
     * only(spec) = forbid() + allow(spec) for every aspect in the spec.
     */
    only(spec){
        const normalized = this.#normalize_spec(spec);
        _.forOwn(normalized, (value, aspect)=>
            set_default(this.policies[aspect], false));
        return this.#apply_policy_spec(normalized, true);
    }
    add_validator(fn){
        if (!_.isFunction(fn))
            throw new Js_sanitizer_error('bad node validator');
        this.node_validators.push(fn);
        return this;
    }
    /** Fully re-open every aspect (discards current policy). */
    reset(){
        _.forOwn(this.policies, policy=>{
            policy.default_allow = true;
            policy.allow.clear();
            policy.forbid.clear();
        });
        return this;
    }
    #check_builtin_policies(ctx, fail){
        const {node, parent, grandparent, scope, ancestors} = ctx;
        _.forOwn(this.policies, (policy, aspect)=>{
            const value = aspect_value[aspect](node, parent, grandparent,
                scope, ancestors);
            if (!check_policy(policy, value))
                fail(`${aspect} ${value} is not allowed`, node);
        });
    }
    parse(code){
        const fail = this.fail.bind(this);
        if (!_.isString(code))
            fail('code must be a string');
        if (code.length>this.max_code_len)
            fail('code is too large');
        try {
            return acorn.parse(code, this.parse_opt);
        } catch(e){
            const loc_node = e.loc && {loc: {start: e.loc}};
            const err = new Js_sanitizer_error(
                'syntax error: '+e.message, loc_node);
            err.cause = e;
            throw err;
        }
    }
    #make_ctx(node, ancestors, scope){
        const parent = ancestors[ancestors.length-2];
        const grandparent = ancestors[ancestors.length-3];
        return {
            node,
            parent,
            grandparent,
            ancestors,
            scope,
            sanitizer: this,
            prop_name,
            member_name,
            member_path,
            call_name,
            new_name,
            is_identifier_reference,
            is_global_identifier_reference:
                (n=node, p=parent, gp=grandparent, s=scope)=>
                    is_global_identifier_reference(n, p, gp, s),
            scope_has_binding: (name, s=scope)=>
                !!scope_binding_scope(s, name),
            scope_binding_scope: (name, s=scope)=>
                scope_binding_scope(s, name),
        };
    }
    sanitize(code){
        const ast = this.parse(code);
        const fail = this.fail.bind(this);
        this.validate_shape(ast, fail, {sanitizer: this});
        walk_all(ast, (node, ancestors, scope)=>{
            const ctx = this.#make_ctx(node, ancestors, scope);
            this.#check_builtin_policies(ctx, fail);
            for (const validate_node of this.node_validators)
                validate_node(node, ctx.parent, ctx.grandparent, fail, ctx);
        });
        return true;
    }
}
