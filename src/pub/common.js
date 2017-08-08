// LICENSE_CODE ZON ISC
'use strict'; /*jslint react:true*/
import _ from 'lodash';
import React from 'react';
import {Modal} from 'react-bootstrap';

class Dialog extends React.Component {
    render(){
        return <Modal {..._.omit(this.props, ['title', 'footer', 'children'])}>
              <Modal.Header closeButton>
                <Modal.Title>{this.props.title}</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {this.props.children}
              </Modal.Body>
              <Modal.Footer>
                {this.props.footer}
              </Modal.Footer>
            </Modal>;
    }
}

export {Dialog};
