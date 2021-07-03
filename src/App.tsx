import React, { useState } from 'react';
import {
  Theme,
  createStyles,
  withStyles,
  WithStyles,
} from '@material-ui/core/styles';
import WalletConnect from './WalletConnect';
import Settings from './Settings';
import NanoApp from './NanoApp';
import Header from './Header';

const styles = (theme: Theme) => createStyles({
  main: {
    flex: 1,
    padding: theme.spacing(3, 3),
    background: '#eaeff1',
    height: "100%",
    overflowY: "scroll"
  },
});

const categories = [
  "WalletConnect",
  "Settings",
  "Nano apps",
]

const pagesMap = {
  "WalletConnect": WalletConnect,
  "Settings": Settings,
  "Nano apps": NanoApp,
}

export interface PaperbaseProps extends WithStyles<typeof styles> {}

function Paperbase(props: PaperbaseProps) {
  const { classes } = props;
  const [category, setCategory] = useState(0);

  // @ts-ignore
  const Page = pagesMap[categories[category]];

  return (
    <React.Fragment>
      <Header categories={categories} setCategory={setCategory} category={category} />
      <main className={classes.main}>
      <Page />
      </main>
    </React.Fragment>
  );
}

export default withStyles(styles)(Paperbase);
