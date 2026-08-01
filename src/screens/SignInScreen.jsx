import { useEffect } from 'react';
import NativeLoginCard from '@/components/NativeLoginCard';

/** Omega 3 login — Google / Apple / Microsoft / email. No gallery shell. */
export default function SignInScreen({ clearSignedOut = false }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-rb-screen', 'sign-in');
    const { style: htmlStyle } = document.documentElement;
    const { style: bodyStyle } = document.body;
    const prevHtmlOverflow = htmlStyle.overflow;
    const prevHtmlHeight = htmlStyle.height;
    const prevBodyOverflow = bodyStyle.overflow;
    const prevBodyHeight = bodyStyle.height;
    const prevBodyOverscroll = bodyStyle.overscrollBehaviorY;

    htmlStyle.height = '100%';
    htmlStyle.overflow = 'hidden';
    bodyStyle.height = '100%';
    bodyStyle.overflow = 'hidden';
    bodyStyle.overscrollBehaviorY = 'none';

    return () => {
      document.documentElement.removeAttribute('data-rb-screen');
      htmlStyle.overflow = prevHtmlOverflow;
      htmlStyle.height = prevHtmlHeight;
      bodyStyle.overflow = prevBodyOverflow;
      bodyStyle.height = prevBodyHeight;
      bodyStyle.overscrollBehaviorY = prevBodyOverscroll;
    };
  }, []);

  return <NativeLoginCard clearSignedOut={clearSignedOut} />;
}
