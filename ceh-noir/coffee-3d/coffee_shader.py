"""Native shader counterpart of the browser's deterministic crema advection."""
import bpy


def flow_nodes(nodes, links, uv, alpha=False):
    def math(op, *args):
        node = nodes.new('ShaderNodeMath')
        node.operation = op
        for i, value in enumerate(args):
            if isinstance(value, bpy.types.NodeSocket):
                links.new(value, node.inputs[i])
            else:
                node.inputs[i].default_value = value
        return node.outputs[0]

    def control(name):
        node = nodes.new('ShaderNodeValue')
        node.name = 'Coffee_'+name
        return node.outputs[0]

    def separate(vector):
        node = nodes.new('ShaderNodeSeparateXYZ')
        links.new(vector, node.inputs[0])
        return node.outputs['X'], node.outputs['Y']

    def smooth(a, b, value):
        node = nodes.new('ShaderNodeMapRange')
        node.interpolation_type = 'SMOOTHSTEP'
        node.clamp = True
        for name, arg in [('Value', value), ('From Min', a), ('From Max', b)]:
            if isinstance(arg, bpy.types.NodeSocket):
                links.new(arg, node.inputs[name])
            else:
                node.inputs[name].default_value = arg
        return node.outputs[0]

    phase, agitation = control('Phase'), control('Agitation')
    u, v = separate(uv)
    x, y = math('SUBTRACT', math('MULTIPLY', u, 2), 1), math('SUBTRACT', math('MULTIPLY', v, 2), 1)
    t = math('SQRT', math('ADD', math('MULTIPLY', x, x), math('MULTIPLY', y, y)))
    a = math('ARCTAN2', y, x)
    twist = math('ADD', math('MULTIPLY', math('MULTIPLY', phase, .34), math('POWER', math('SUBTRACT', 1, t), 2)),
                 math('MULTIPLY', math('MULTIPLY', agitation, .012), math('SINE', math('ADD', math('ADD', math('MULTIPLY', a, 3), math('MULTIPLY', phase, 8)), math('MULTIPLY', t, 10)))))
    r = math('MULTIPLY', .5, math('MULTIPLY', t, math('SUBTRACT', 1, math('MULTIPLY', math('MULTIPLY', .18, phase), math('SUBTRACT', 1, t)))))
    angle = math('ADD', a, twist)
    combine = nodes.new('ShaderNodeCombineXYZ')
    links.new(math('ADD', .5, math('MULTIPLY', r, math('COSINE', angle))), combine.inputs['X'])
    links.new(math('ADD', .5, math('MULTIPLY', r, math('SINE', angle))), combine.inputs['Y'])
    mask = None
    if alpha:
        geo = nodes.new('ShaderNodeNewGeometry')
        px, py = separate(geo.outputs['Position'])
        dx = math('SUBTRACT', px, control('ImpactX'))
        dy = math('SUBTRACT', control('ImpactY'), py)
        distance = math('SQRT', math('ADD', math('MULTIPLY', dx, dx), math('MULTIPLY', dy, dy)))
        angle = math('ARCTAN2', dy, dx)
        edge = math('MULTIPLY', .0045, math('ADD', 1, math('ADD',
                    math('MULTIPLY', .18, math('SINE', math('ADD', math('MULTIPLY', angle, 3), math('MULTIPLY', phase, 7)))),
                    math('MULTIPLY', .09, math('SINE', math('SUBTRACT', math('MULTIPLY', angle, 5), math('MULTIPLY', phase, 11)))))))
        mask = math('SUBTRACT', 1, math('MULTIPLY', math('MULTIPLY', .97, control('Impact')), math('SUBTRACT', 1, smooth(.0019, edge, distance))))
    return combine.outputs[0], mask
