import React from 'react'
import logger from '../logger'
import Link from 'next/link'

export default function about() {

  logger.debug('about');

  return (<div>about
    <Link href={'/'}>home</Link>
  </div>)
}