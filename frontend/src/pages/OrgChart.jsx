import { useState, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { employeeAPI } from '../services/api';
import { Network, ZoomIn, ZoomOut, Maximize, AlertCircle } from 'lucide-react';

const OrgChart = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await employeeAPI.getAll({ limit: 1000 });
            setEmployees(response.data.data);
            setError(null);
        } catch (err) {
            console.error('Error fetching employees for org chart:', err);
            setError('Failed to load organization data.');
        } finally {
            setLoading(false);
        }
    };

    // Build hierarchical tree
    const buildTree = () => {
        const nodesMap = {};
        const roots = [];

        // Initialize maps
        employees.forEach(emp => {
            nodesMap[emp.id] = { ...emp, children: [] };
        });

        // Build relations
        employees.forEach(emp => {
            if (emp.managerId && nodesMap[emp.managerId]) {
                nodesMap[emp.managerId].children.push(nodesMap[emp.id]);
            } else {
                roots.push(nodesMap[emp.id]);
            }
        });

        return roots;
    };

    const OrgNode = ({ node }) => (
        <li>
            <div className="card w-64 mx-auto !p-4 hover:shadow-lg transition-all duration-300 border-2 border-surface-100 hover:border-primary-300 cursor-grab active:cursor-grabbing bg-white relative z-10 group">
                <div className="absolute top-0 left-0 w-full h-1 bg-primary-500 rounded-t-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-xl mb-3 shadow-inner ring-4 ring-white">
                        {node.name?.[0]?.toUpperCase()}
                    </div>
                    <h3 className="font-bold text-surface-800 text-lg leading-tight mb-1">{node.name}</h3>
                    <p className="text-sm font-medium text-primary-600 mb-2">{node.position}</p>
                    <span className="text-xs text-surface-500 bg-surface-100 px-3 py-1 rounded-full font-medium">
                        {node.department}
                    </span>
                </div>
            </div>
            {node.children && node.children.length > 0 && (
                <ul>
                    {node.children.map(child => (
                        <OrgNode key={child.id} node={child} />
                    ))}
                </ul>
            )}
        </li>
    );

    const roots = buildTree();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[500px]">
                <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card text-center py-12 max-w-lg mx-auto mt-10">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-surface-800">{error}</h3>
                <button onClick={fetchData} className="btn btn-primary mt-4">Try Again</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
            <style dangerouslySetInnerHTML={{__html: `
                .org-tree ul {
                    padding-top: 30px;
                    position: relative;
                    display: flex;
                    justify-content: center;
                }
                .org-tree li {
                    float: left;
                    text-align: center;
                    list-style-type: none;
                    position: relative;
                    padding: 30px 10px 0 10px;
                }
                /* We use ::before and ::after to draw the connectors */
                .org-tree li::before, .org-tree li::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    right: 50%;
                    border-top: 2px solid #cbd5e1; /* Tailwind surface-300 */
                    width: 50%;
                    height: 30px;
                }
                .org-tree li::after {
                    right: auto;
                    left: 50%;
                    border-left: 2px solid #cbd5e1;
                }
                /* Remove left/right connect on first/last child */
                .org-tree li:only-child::after, .org-tree li:only-child::before {
                    display: none;
                }
                .org-tree li:only-child {
                    padding-top: 0;
                }
                .org-tree li:first-child::before, .org-tree li:last-child::after {
                    border: 0 none;
                }
                /* Connect parents to children */
                .org-tree li:first-child::after {
                    border-radius: 8px 0 0 0;
                }
                .org-tree li:last-child::before {
                    border-right: 2px solid #cbd5e1;
                    border-radius: 0 8px 0 0;
                }
                /* Downward lines from parents */
                .org-tree ul ul::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 50%;
                    border-left: 2px solid #cbd5e1;
                    width: 0;
                    height: 30px;
                    margin-left: -1px; /* Center perfectly over the 2px border */
                }
            `}} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-3">
                        <Network className="w-7 h-7 text-primary-600" />
                        Organization Chart
                    </h1>
                    <p className="text-surface-500 mt-1">Interactive company reporting structure</p>
                </div>
            </div>

            {/* Interactive Canvas */}
            <div className="flex-1 bg-surface-50 rounded-2xl border border-surface-200 overflow-hidden relative shadow-inner">
                {roots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-surface-500">
                        <Network className="w-12 h-12 mb-2 text-surface-300" />
                        <p>No employees found.</p>
                    </div>
                ) : (
                    <TransformWrapper
                        initialScale={1}
                        minScale={0.2}
                        maxScale={2}
                        centerOnInit={true}
                        wheel={{ step: 0.1 }}
                    >
                        {({ zoomIn, zoomOut, resetTransform }) => (
                            <>
                                <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-white/80 backdrop-blur shadow-sm p-2 rounded-xl border border-surface-200">
                                    <button onClick={() => zoomIn()} className="p-2 text-surface-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Zoom In">
                                        <ZoomIn className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => zoomOut()} className="p-2 text-surface-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Zoom Out">
                                        <ZoomOut className="w-5 h-5" />
                                    </button>
                                    <div className="w-full h-[1px] bg-surface-200 my-1"></div>
                                    <button onClick={() => resetTransform()} className="p-2 text-surface-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Reset View">
                                        <Maximize className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                                    <div className="org-tree p-10 min-w-max min-h-max flex items-center justify-center">
                                        <ul>
                                            {/* We can have multiple roots (e.g. CEO and Board) */}
                                            {roots.map(root => (
                                                <OrgNode key={root.id} node={root} />
                                            ))}
                                        </ul>
                                    </div>
                                </TransformComponent>
                            </>
                        )}
                    </TransformWrapper>
                )}
            </div>
        </div>
    );
};

export default OrgChart;
