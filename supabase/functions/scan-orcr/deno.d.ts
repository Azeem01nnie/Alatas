/** Local ambient types so the IDE can check Edge Function files without Deno tooling. */

declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined
    }
    function serve(
      handler: (request: Request) => Response | Promise<Response>,
    ): void
  }
}

export {}
