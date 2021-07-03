import React from 'react';
import Paper from '@material-ui/core/Paper';
import { createStyles, Theme, withStyles, WithStyles } from '@material-ui/core/styles';

const styles = (theme: Theme) =>
  createStyles({
    paper: {
      display: "flex",
      flexDirection: "column",
      flex: 1,
      padding: theme.spacing(3, 3)
    },
  });

export interface WalletConnectProps extends WithStyles<typeof styles> {}

function WalletConnect(props: WalletConnectProps) {
  const { classes } = props;

  return (
    <Paper className={classes.paper}>
      WC
    </Paper>
  );
}

export default withStyles(styles)(WalletConnect);
