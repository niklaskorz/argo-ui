import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Observable, Subscription } from 'rxjs';
import { AppContext } from '../context';
import { ErrorNotification } from './error-notification';
import { NotificationType } from './notifications/notifications';

interface LoaderProps<I, D> {
    load: (input: I) => Promise<D> | Observable<D>;
    input?: I;
    loadingRenderer?: React.ComponentType;
    errorRenderer?: (children: React.ReactNode) => React.ReactNode;
    children: (data: D) => React.ReactNode;
}

export class DataLoader<D = {}, I = {}> extends React.Component<LoaderProps<I, D>, { loading: boolean; data: D; error: boolean; input: I; }> {
    public static contextTypes = {
        router: PropTypes.object,
        apis: PropTypes.object,
    };

    public static getDerivedStateFromProps(nextProps: LoaderProps<any, any>, prevState: { input: any }) {
        if (JSON.stringify(nextProps.input) !== JSON.stringify(prevState.input)) {
            return { data: null as any, input: nextProps.input };
        }
        return null;
    }

    private subscription: Subscription;
    private unmounted = false;

    constructor(props: LoaderProps<I, D>) {
        super(props);
        this.state = { loading: false, error: false, data: null, input: props.input };
    }

    public getData() {
        return this.state.data;
    }

    public setData(data: D) {
        return this.setState({ data });
    }

    public componentDidMount() {
        this.loadData();
    }

    public componentDidUpdate() {
        this.loadData();
    }

    public componentWillUnmount() {
        this.ensureUnsubscribed();
        this.unmounted = true;
    }

    public render() {
        const style: React.CSSProperties = {padding: '0.5em', textAlign: 'center'};
        if (this.state.error) {
            const error = <p style={style}>Failed to load data, please <a onClick={() => this.reload()}>try again</a>.</p>;
            if (this.props.errorRenderer) {
                return this.props.errorRenderer(error);
            }
            return error;
        }
        if (this.state.data) {
            return this.props.children(this.state.data);
        }
        return this.props.loadingRenderer ? <this.props.loadingRenderer/> : <p style={style}>Loading...</p>;
    }

    public reload() {
        this.setState({ data: null, error: false });
    }

    private async loadData() {
        if (!this.state.error && !this.state.loading && this.state.data == null) {
            this.setState({ error: false, loading: true });
            try {
                const res = this.props.load(this.props.input);
                if ((res as Promise<D>).then) {
                    const data = await (res as Promise<D>);
                    if (!this.unmounted) {
                        this.setState({ data, loading: false });
                    }
                } else {
                    this.ensureUnsubscribed();
                    this.subscription = (res as Observable<D>).subscribe((data: D) => this.setState({ loading: false, data }), (e) => this.handleError(e));
                }
            } catch (e) {
                this.handleError(e);
            }
        }
    }

    private handleError(e: any) {
        if (!this.unmounted) {
            this.setState({ error: true, loading: false });
            if (e.status !== 401) {
                this.appContext.apis.notifications.show({
                    content: <ErrorNotification title='Unable to load data' e={e}/>,
                    type: NotificationType.Error,
                });
            }
        }
    }

    private ensureUnsubscribed() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.subscription = null;
    }

    private get appContext(): AppContext {
        return this.context as AppContext;
    }
}
