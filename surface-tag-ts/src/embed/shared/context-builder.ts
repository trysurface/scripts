import { IframeUtilsContext } from './iframe-utils';

/**
 * Creates the base iframe utils context properties that are common across all embed types.
 * This eliminates repetitive code in context getters.
 */
export function createBaseIframeContext(embed: {
  iframe: HTMLIFrameElement | null;
  _cachedOptionsKey: string | null;
  _iframePreloaded: boolean;
  _cachedSrcUrl: string | null;
  src: URL;
  log: (level: string, message: string) => void;
}): IframeUtilsContext {
  return {
    iframe: embed.iframe,
    _cachedOptionsKey: embed._cachedOptionsKey,
    _iframePreloaded: embed._iframePreloaded,
    _getSrcUrl: () => {
      if (!embed._cachedSrcUrl) {
        embed._cachedSrcUrl = embed.src.toString();
      }
      return embed._cachedSrcUrl;
    },
    log: (level: string, message: string) => embed.log(level, message),
    _updateCachedOptionsKey: (key: string | null) => { embed._cachedOptionsKey = key; },
    _updateIframePreloaded: (preloaded: boolean) => { embed._iframePreloaded = preloaded; },
    _updateIframe: (iframe: HTMLIFrameElement | null) => { embed.iframe = iframe; },
  };
}
