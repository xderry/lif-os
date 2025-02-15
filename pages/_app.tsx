import { type AppProps } from "next/app";
import { ErrorBoundary } from "components/pages/ErrorBoundary";
import Metadata from "components/pages/Metadata";
import StyledApp from "components/pages/StyledApp";
import { FileSystemProvider } from "contexts/fileSystem";
import { MenuProvider } from "contexts/menu";
import { ProcessProvider } from "contexts/process";
import { SessionProvider } from "contexts/session";
import { ViewportProvider } from "contexts/viewport";

import Idx from "./index.tsx";
const App = ({ Component, pageProps }: AppProps): React.ReactElement => (
  <ViewportProvider>
    <ProcessProvider>
      <FileSystemProvider>
        <SessionProvider>
          <ErrorBoundary>
            <Metadata />
            <StyledApp>
              <MenuProvider>
                <Idx />
              </MenuProvider>
            </StyledApp>
          </ErrorBoundary>
        </SessionProvider>
      </FileSystemProvider>
    </ProcessProvider>
  </ViewportProvider>
);

                //<Component {...pageProps} />
export default App;
