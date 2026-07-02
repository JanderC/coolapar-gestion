import React from 'react';
import { Row, Col } from 'react-bootstrap';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = ({ children }) => {
  return (
    <Row className="g-0">
      <Col xs={12} md={3} lg={2}>
        <Sidebar />
      </Col>
      <Col xs={12} md={9} lg={10}>
        <Navbar />
        <div className="p-4">{children}</div>
      </Col>
    </Row>
  );
};

export default Layout;
