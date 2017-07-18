
// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
define(['regenerator-runtime', 'lodash', 'react', 'react-dom',
    'react-bootstrap', 'axios', '/util.js', 'hutil/etask', 'hutil/date',
    '_css!animate'],
(rr, _, React, ReactDOM, RB, axios, util, etask, date)=>{

const E = {};

class StatTable extends React.Component {
    render(){
        const Row = this.props.row, {Table} = RB;
        return <div>
              <h4>
                {this.props.title}
                {false && this.props.show_more &&
                  <small>&nbsp;<a href={this.props.path}>show all</a></small>}
              </h4>
              <Table bordered condensed>
                <thead>{this.props.children}</thead>
                <tbody>
                  {this.props.stats.map(s=>
                    <Row stat={s} key={s[this.props.row_key||'key']}
                      path={this.props.path} />)}
                </tbody>
              </Table>
            </div>;
    }
}

E.StatTable = StatTable;

return E; });
