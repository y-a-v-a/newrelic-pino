import React from 'react'
import logger from '../logger'
import Link from 'next/link'

export default function index() {

  logger.debug('index');

  return (<div>
    index
    <Link href={'/about'}>about</Link>
    </div>)
}